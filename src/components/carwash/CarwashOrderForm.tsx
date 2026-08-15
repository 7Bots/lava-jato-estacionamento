import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Check, Search, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatPlate, normalizePlate, useCustomers, useVehicles } from "@/lib/db";
import { formatCents } from "@/lib/format";
import {
  CARWASH_VEHICLE_TYPES,
  useCarwashServices,
  type CarwashService,
} from "@/lib/carwash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function CarwashOrderForm({ onDone }: { onDone?: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: customers = [] } = useCustomers();
  const { data: vehicles = [] } = useVehicles();
  const { data: services = [] } = useCarwashServices();
  const activeServices = useMemo(() => services.filter((s) => s.active), [services]);

  const [type, setType] = useState<string>("car");
  const [plate, setPlate] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [brand, setBrand] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [matchedCustomerId, setMatchedCustomerId] = useState<string | null>(null);
  const [matchedVehicleId, setMatchedVehicleId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const chosen: CarwashService[] = activeServices.filter((s) => selected.includes(s.id));
  const subtotal = chosen.reduce((a, s) => a + s.price_cents, 0);

  function applyCustomer(c: {
    id: string;
    name: string;
    phone: string | null;
    cpf: string | null;
    email: string | null;
  }) {
    setMatchedCustomerId(c.id);
    setName(c.name);
    setPhone(c.phone ?? "");
    setCpf(c.cpf ?? "");
    setEmail(c.email ?? "");
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
    if (c) applyCustomer(c);
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
    if (!name.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    if (chosen.length === 0) {
      toast.error("Selecione pelo menos um serviço.");
      return;
    }
    if (!user) return;

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
            type: type === "moto" ? "moto" : "car",
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

      const { data: ticket, error: tErr } = await supabase
        .from("carwash_tickets")
        .insert({
          owner_id: user.id,
          customer_id: customerId,
          vehicle_id: vehicleId,
          vehicle_type: type,
          plate: p,
          stage: "novo",
          subtotal_cents: subtotal,
          total_cents: subtotal,
          notes: notes || null,
        })
        .select("id")
        .single();
      if (tErr) throw tErr;

      const { error: sErr } = await supabase.from("carwash_ticket_services").insert(
        chosen.map((s) => ({
          owner_id: user.id,
          ticket_id: ticket.id,
          service_id: s.id,
          name_snapshot: s.name,
          price_cents_snapshot: s.price_cents,
        })),
      );
      if (sErr) throw sErr;

      toast.success(`Adicionado à fila — ${formatPlate(p)}`);
      qc.invalidateQueries({ queryKey: ["carwash_tickets"] });
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
      setSelected([]);
      setMatchedCustomerId(null);
      setMatchedVehicleId(null);
      onDone?.();
    } catch {
      toast.error("Não foi possível criar a ordem de serviço.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <Label>Tipo de veículo</Label>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CARWASH_VEHICLE_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={cn(
                "min-h-11 rounded-lg border text-sm font-semibold transition-colors",
                type === t.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="cwplate">Placa *</Label>
        <Input
          id="cwplate"
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
        <Label htmlFor="cwsearch">Buscar cliente</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="cwsearch"
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
                  applyCustomer(c);
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
          <Label htmlFor="cwname">Nome *</Label>
          <Input id="cwname" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cwphone">Telefone</Label>
          <Input id="cwphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cwcpf">CPF</Label>
          <Input id="cwcpf" value={cpf} onChange={(e) => setCpf(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cwemail">E-mail</Label>
          <Input
            id="cwemail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="cwmodel">Modelo</Label>
          <Input id="cwmodel" value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cwcolor">Cor</Label>
          <Input id="cwcolor" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cwbrand">Marca</Label>
          <Input id="cwbrand" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </div>
      </div>

      <div>
        <Label htmlFor="cwnotes">Observações</Label>
        <Textarea id="cwnotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div>
        <Label>Serviços *</Label>
        {activeServices.length === 0 ? (
          <p className="mt-1 rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            Cadastre serviços na aba Serviços.
          </p>
        ) : (
          <div className="mt-1 flex flex-wrap gap-2">
            {activeServices.map((s) => {
              const on = selected.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    setSelected((prev) =>
                      on ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                    )
                  }
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-all",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-accent",
                  )}
                >
                  {on && <Check className="size-4" />}
                  {s.name}
                  <span className="tabular opacity-80">{formatCents(s.price_cents)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <span className="text-sm uppercase text-muted-foreground">Subtotal</span>
        <span className="text-display text-3xl leading-none text-primary tabular">
          {formatCents(subtotal)}
        </span>
      </div>

      <Button type="submit" className="min-h-12 w-full text-base" disabled={saving}>
        <Sparkles className="size-4" />
        {saving ? "Adicionando..." : "Adicionar à fila"}
      </Button>
    </form>
  );
}
