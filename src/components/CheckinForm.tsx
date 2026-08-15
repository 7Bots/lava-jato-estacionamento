import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Car, Bike, Search, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  formatPlate,
  isValidPlate,
  normalizePlate,
  useCustomers,
  useVehicles,
  type Settings,
  type Spot,
  type Ticket,
  type VehicleType,
} from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function CheckinForm({
  settings,
  spots,
  activeTickets,
  defaultSpotId,
  defaultCustomerId,
  onDone,
}: {
  settings: Settings | null;
  spots: Spot[];
  activeTickets: Ticket[];
  defaultSpotId?: string | null;
  defaultCustomerId?: string | null;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: customers = [] } = useCustomers();
  const { data: vehicles = [] } = useVehicles();

  const [type, setType] = useState<VehicleType>("car");
  const [plate, setPlate] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [brand, setBrand] = useState("");
  const [spotId, setSpotId] = useState<string | null>(defaultSpotId ?? null);
  const [matchedCustomerId, setMatchedCustomerId] = useState<string | null>(null);
  const [matchedVehicleId, setMatchedVehicleId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (defaultSpotId) {
      const s = spots.find((sp) => sp.id === defaultSpotId);
      if (s) {
        setType(s.type);
        setSpotId(s.id);
      }
    }
  }, [defaultSpotId, spots]);

  useEffect(() => {
    if (!defaultCustomerId) return;
    const c = customers.find((x) => x.id === defaultCustomerId);
    if (c) applyCustomer(c.id, c.name, c.phone, c.cpf, c.email);
  }, [defaultCustomerId, customers.length]);

  const occupiedSpotIds = useMemo(
    () => new Set(activeTickets.map((t) => t.spot_id).filter(Boolean) as string[]),
    [activeTickets],
  );
  const availableSpots = spots.filter(
    (s) => s.type === type && s.active && !occupiedSpotIds.has(s.id),
  );

  function applyCustomer(
    id: string,
    cname: string,
    cphone: string | null,
    ccpf: string | null,
    cemail: string | null,
  ) {
    setMatchedCustomerId(id);
    setName(cname);
    setPhone(cphone ?? "");
    setCpf(ccpf ?? "");
    setEmail(cemail ?? "");
  }

  function handlePlateBlur() {
    const p = normalizePlate(plate);
    if (!p) return;
    const v = vehicles.find((x) => x.plate === p);
    if (!v) {
      setMatchedVehicleId(null);
      return;
    }
    setMatchedVehicleId(v.id);
    setType(v.type);
    setModel(v.model ?? "");
    setColor(v.color ?? "");
    setBrand(v.brand ?? "");
    const c = customers.find((x) => x.id === v.customer_id);
    if (c) applyCustomer(c.id, c.name, c.phone, c.cpf, c.email);
  }

  const searchResults = customerSearch.trim()
    ? customers
        .filter((c) => {
          const q = customerSearch.toLowerCase();
          const plates = vehicles
            .filter((v) => v.customer_id === c.id)
            .map((v) => v.plate.toLowerCase())
            .join(" ");
          return (
            c.name.toLowerCase().includes(q) ||
            (c.phone ?? "").includes(q) ||
            (c.cpf ?? "").includes(q) ||
            plates.includes(q)
          );
        })
        .slice(0, 5)
    : [];

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const p = normalizePlate(plate);
    if (!p) {
      toast.error("Informe a placa do veículo.");
      return;
    }
    if (!isValidPlate(p)) {
      toast.error("Placa inválida. Use o formato AAA-0A00 ou AAA-0000.");
      return;
    }
    if (!name.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    if (!spotId) {
      toast.error("Selecione uma vaga.");
      return;
    }
    if (activeTickets.some((t) => t.plate === p)) {
      toast.error("Já existe uma comanda aberta para esta placa.");
      return;
    }
    if (!settings || !user) {
      toast.error("Configurações não carregadas.");
      return;
    }

    setSaving(true);
    try {
      let customerId = matchedCustomerId;
      if (!customerId) {
        const { data, error } = await supabase
          .from("customers")
          .insert({
            owner_id: user.id,
            name: name.trim(),
            phone: phone || null,
            cpf: cpf || null,
            email: email || null,
            notes: notes || null,
            auto_created: true,
          })
          .select("id")
          .single();
        if (error) throw error;
        customerId = data.id;
      }

      let vehicleId = matchedVehicleId;
      if (!vehicleId) {
        const { data, error } = await supabase
          .from("vehicles")
          .insert({
            owner_id: user.id,
            customer_id: customerId,
            type,
            plate: p,
            model: model || null,
            color: color || null,
            brand: brand || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        vehicleId = data.id;
      }

      const { error: tErr } = await supabase.from("tickets").insert({
        owner_id: user.id,
        customer_id: customerId,
        vehicle_id: vehicleId,
        spot_id: spotId,
        vehicle_type: type,
        plate: p,
        price_block_cents:
          type === "car" ? settings.price_car_cents : settings.price_moto_cents,
        daily_cents: type === "car" ? settings.daily_car_cents : settings.daily_moto_cents,
        block_minutes: settings.block_minutes,
        grace_minutes: settings.grace_minutes,
        status: "open",
      });
      if (tErr) throw tErr;

      toast.success(`Check-in realizado — ${formatPlate(p)}`);
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      setPlate("");
      setName("");
      setPhone("");
      setCpf("");
      setEmail("");
      setNotes("");
      setModel("");
      setColor("");
      setBrand("");
      setSpotId(null);
      setMatchedCustomerId(null);
      setMatchedVehicleId(null);
      onDone?.();
    } catch {
      toast.error("Não foi possível concluir o check-in.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <Label>Tipo de veículo</Label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(["car", "moto"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setType(t);
                setSpotId(null);
              }}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors",
                type === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent",
              )}
            >
              {t === "car" ? <Car className="size-4" /> : <Bike className="size-4" />}
              {t === "car" ? "Carro" : "Moto"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="plate">Placa *</Label>
        <Input
          id="plate"
          value={formatPlate(plate)}
          onChange={(e) => setPlate(normalizePlate(e.target.value))}
          onBlur={handlePlateBlur}
          placeholder="AAA-0A00"
          className="text-display h-12 text-2xl tracking-widest"
          autoComplete="off"
        />
      </div>

      {matchedCustomerId && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-lg border border-free/40 bg-free/10 px-3 py-2 text-sm"
        >
          <Check className="size-4 text-free" />
          <span>
            Cliente reconhecido: <strong>{name}</strong>
          </span>
        </motion.div>
      )}

      <div>
        <Label htmlFor="csearch">Buscar cliente</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="csearch"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            placeholder="Nome, telefone, CPF ou placa"
            className="pl-9"
            autoComplete="off"
          />
        </div>
        {searchResults.length > 0 && (
          <div className="mt-1 overflow-hidden rounded-lg border border-border">
            {searchResults.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  applyCustomer(c.id, c.name, c.phone, c.cpf, c.email);
                  setCustomerSearch("");
                  const v = vehicles.find((x) => x.customer_id === c.id);
                  if (v) {
                    setPlate(v.plate);
                    setMatchedVehicleId(v.id);
                    setType(v.type);
                    setModel(v.model ?? "");
                    setColor(v.color ?? "");
                  }
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span className="font-semibold">{c.name}</span>
                <span className="text-muted-foreground">{c.phone ?? ""}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Nome *</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cpf">CPF</Label>
          <Input id="cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="model">Modelo</Label>
          <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="color">Cor</Label>
          <Input id="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="brand">Marca</Label>
          <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Observações</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div>
        <Label>Vaga *</Label>
        {availableSpots.length === 0 ? (
          <p className="mt-1 rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            {type === "car"
              ? "Nenhuma vaga de carro disponível"
              : "Nenhuma vaga de moto disponível"}
          </p>
        ) : (
          <div className="mt-1 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {availableSpots.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSpotId(s.id)}
                className={cn(
                  "min-h-11 rounded-lg border text-sm font-semibold transition-all",
                  spotId === s.id
                    ? "scale-105 border-primary bg-primary text-primary-foreground"
                    : "border-free/40 bg-free/10 text-foreground hover:bg-free/20",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          className="min-h-12 flex-1 text-base"
          disabled={saving || availableSpots.length === 0}
        >
          {saving ? "Registrando..." : "Fazer check-in"}
        </Button>
        {matchedVehicleId && <Badge variant="secondary">Veículo já cadastrado</Badge>}
      </div>
    </form>
  );
}
