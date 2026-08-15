import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Trash2, Wrench, Check } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { computeBilling } from "@/lib/billing";
import { centsToReaisInput, formatCents, parseReaisToCents } from "@/lib/format";
import { useActiveTickets, useSettings, useSpots, type Spot } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações | BelParking" },
      { name: "description", content: "Preços, blocos de cobrança, vagas e dados do negócio." },
      { property: "og:title", content: "Configurações | BelParking" },
      { property: "og:description", content: "Preços, vagas e dados do negócio." },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: settings, isLoading } = useSettings();
  const { data: spots = [] } = useSpots();
  const { data: activeTickets = [] } = useActiveTickets();

  const [priceCar, setPriceCar] = useState("3,00");
  const [priceMoto, setPriceMoto] = useState("2,00");
  const [dailyCar, setDailyCar] = useState("30,00");
  const [dailyMoto, setDailyMoto] = useState("25,00");
  const [blockMinutes, setBlockMinutes] = useState("30");
  const [graceMinutes, setGraceMinutes] = useState("0");
  const [bizName, setBizName] = useState("");
  const [bizDoc, setBizDoc] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const [carCount, setCarCount] = useState("0");
  const [motoCount, setMotoCount] = useState("0");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setPriceCar(centsToReaisInput(settings.price_car_cents));
    setPriceMoto(centsToReaisInput(settings.price_moto_cents));
    setDailyCar(centsToReaisInput(settings.daily_car_cents));
    setDailyMoto(centsToReaisInput(settings.daily_moto_cents));
    setBlockMinutes(String(settings.block_minutes));
    setGraceMinutes(String(settings.grace_minutes));
    setBizName(settings.business_name ?? "");
    setBizDoc(settings.business_doc ?? "");
    setBizPhone(settings.business_phone ?? "");
  }, [settings?.id]);

  useEffect(() => {
    setCarCount(String(spots.filter((s) => s.type === "car").length));
    setMotoCount(String(spots.filter((s) => s.type === "moto").length));
  }, [spots.length]);

  const preview = useMemo(() => {
    const checkin = new Date(0);
    const checkout = new Date(2 * 60 * 60 * 1000 + 15 * 60 * 1000);
    return computeBilling({
      checkinAt: checkin,
      checkoutAt: checkout,
      priceBlockCents: parseReaisToCents(priceCar),
      dailyCents: parseReaisToCents(dailyCar),
      blockMinutes: Number(blockMinutes) || 30,
      graceMinutes: Number(graceMinutes) || 0,
      forceDaily: false,
      manualDiscountCents: 0,
    });
  }, [priceCar, dailyCar, blockMinutes, graceMinutes]);

  const occupied = new Set(activeTickets.map((t) => t.spot_id).filter(Boolean) as string[]);

  async function handleSaveSettings(): Promise<void> {
    if (!user) return;
    setSaving(true);
    const payload = {
      price_car_cents: parseReaisToCents(priceCar),
      price_moto_cents: parseReaisToCents(priceMoto),
      daily_car_cents: parseReaisToCents(dailyCar),
      daily_moto_cents: parseReaisToCents(dailyMoto),
      block_minutes: Math.max(1, Number(blockMinutes) || 30),
      grace_minutes: Math.max(0, Number(graceMinutes) || 0),
      business_name: bizName || null,
      business_doc: bizDoc || null,
      business_phone: bizPhone || null,
    };
    const { error } = settings
      ? await supabase.from("settings").update(payload).eq("id", settings.id)
      : await supabase.from("settings").insert({ ...payload, owner_id: user.id });
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar as configurações.");
      return;
    }
    toast.success("Configurações salvas.");
    qc.invalidateQueries({ queryKey: ["settings"] });
  }

  async function handleGenerateSpots(): Promise<void> {
    if (!user) return;
    setGenerating(true);
    try {
      for (const [type, prefix, desiredRaw] of [
        ["car", "C", carCount],
        ["moto", "M", motoCount],
      ] as const) {
        const desired = Math.max(0, Number(desiredRaw) || 0);
        const existing = spots
          .filter((s) => s.type === type)
          .sort((a, b) => a.label.localeCompare(b.label));
        if (desired > existing.length) {
          const rows = [];
          for (let i = existing.length + 1; i <= desired; i++) {
            rows.push({
              owner_id: user.id,
              type,
              label: `${prefix}-${String(i).padStart(2, "0")}`,
              active: true,
            });
          }
          const { error } = await supabase.from("spots").insert(rows);
          if (error) throw error;
        } else if (desired < existing.length) {
          const toRemove = existing.slice(desired);
          const blocked = toRemove.filter((s) => occupied.has(s.id));
          if (blocked.length > 0) {
            toast.error(
              `Não é possível remover vagas ocupadas: ${blocked.map((s) => s.label).join(", ")}`,
            );
            continue;
          }
          const { error } = await supabase
            .from("spots")
            .delete()
            .in("id", toRemove.map((s) => s.id));
          if (error) throw error;
        }
      }
      toast.success("Vagas atualizadas.");
      qc.invalidateQueries({ queryKey: ["spots"] });
    } catch {
      toast.error("Não foi possível gerar as vagas.");
    } finally {
      setGenerating(false);
    }
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title="Configurações" subtitle="Preços, vagas e dados do negócio" />
        <div className="space-y-4 p-4 md:p-8">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Configurações" subtitle="Preços, vagas e dados do negócio" />

      <div className="grid gap-6 p-4 md:grid-cols-2 md:p-8">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-display mb-4 text-2xl">Tabela de preços</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Valor por bloco — Carro (R$)" value={priceCar} onChange={setPriceCar} />
            <Field label="Valor por bloco — Moto (R$)" value={priceMoto} onChange={setPriceMoto} />
            <Field label="Diária — Carro (R$)" value={dailyCar} onChange={setDailyCar} />
            <Field label="Diária — Moto (R$)" value={dailyMoto} onChange={setDailyMoto} />
            <Field
              label="Duração do bloco (minutos)"
              value={blockMinutes}
              onChange={setBlockMinutes}
            />
            <Field
              label="Tolerância grátis (minutos)"
              value={graceMinutes}
              onChange={setGraceMinutes}
            />
          </div>

          <div className="mt-4 rounded-lg bg-accent px-4 py-3">
            <p className="text-sm text-accent-foreground">
              Um carro que fica 2h15 pagará{" "}
              <strong className="text-display text-2xl text-primary">
                {formatCents(preview.totalCents)}
              </strong>{" "}
              ({preview.blocksCharged} bloco(s))
            </p>
          </div>

          <h2 className="text-display mb-3 mt-6 text-2xl">Dados do negócio</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" value={bizName} onChange={setBizName} />
            <Field label="CNPJ / CPF" value={bizDoc} onChange={setBizDoc} />
            <Field label="Telefone" value={bizPhone} onChange={setBizPhone} />
          </div>

          <Button className="mt-4 min-h-11 w-full" onClick={handleSaveSettings} disabled={saving}>
            <Save className="size-4" /> {saving ? "Salvando..." : "Salvar configurações"}
          </Button>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-display mb-4 text-2xl">Vagas</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Quantidade de vagas de carro" value={carCount} onChange={setCarCount} />
            <Field label="Quantidade de vagas de moto" value={motoCount} onChange={setMotoCount} />
          </div>
          <Button
            className="mt-4 min-h-11 w-full"
            variant="secondary"
            onClick={handleGenerateSpots}
            disabled={generating}
          >
            {generating ? "Gerando..." : "Gerar / ajustar vagas"}
          </Button>

          <div className="mt-5 space-y-2">
            {spots.length === 0 && (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhuma vaga cadastrada ainda.
              </p>
            )}
            {spots.map((s) => (
              <SpotRow key={s.id} spot={s} occupied={occupied.has(s.id)} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z]/g, "");
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-11" />
    </div>
  );
}

function SpotRow({ spot, occupied }: { spot: Spot; occupied: boolean }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState(spot.label);
  const [editing, setEditing] = useState(false);

  async function rename(): Promise<void> {
    const { error } = await supabase.from("spots").update({ label }).eq("id", spot.id);
    if (error) {
      toast.error("Não foi possível renomear a vaga.");
      return;
    }
    setEditing(false);
    toast.success("Vaga renomeada.");
    qc.invalidateQueries({ queryKey: ["spots"] });
  }

  async function toggleActive(): Promise<void> {
    if (occupied) {
      toast.error(`A vaga ${spot.label} está ocupada e não pode ser desativada.`);
      return;
    }
    const { error } = await supabase
      .from("spots")
      .update({ active: !spot.active })
      .eq("id", spot.id);
    if (error) {
      toast.error("Não foi possível atualizar a vaga.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["spots"] });
  }

  async function remove(): Promise<void> {
    if (occupied) {
      toast.error(`A vaga ${spot.label} está ocupada e não pode ser removida.`);
      return;
    }
    const { error } = await supabase.from("spots").delete().eq("id", spot.id);
    if (error) {
      toast.error("Não foi possível remover a vaga.");
      return;
    }
    toast.success("Vaga removida.");
    qc.invalidateQueries({ queryKey: ["spots"] });
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
      {editing ? (
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-9 max-w-32"
          autoFocus
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className={cn("text-sm font-semibold", !spot.active && "text-muted-foreground line-through")}
        >
          {spot.label}
        </button>
      )}
      <Badge variant="outline">{spot.type === "car" ? "Carro" : "Moto"}</Badge>
      {occupied && <Badge className="bg-occupied text-occupied-foreground">Ocupada</Badge>}
      {!spot.active && <Badge className="bg-muted text-muted-foreground">Manutenção</Badge>}
      <div className="ml-auto flex gap-1">
        {editing && (
          <Button size="icon" variant="ghost" aria-label="Salvar nome" onClick={rename}>
            <Check className="size-4" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          aria-label={spot.active ? "Colocar em manutenção" : "Reativar vaga"}
          onClick={toggleActive}
        >
          <Wrench className="size-4" />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Remover vaga" onClick={remove}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
