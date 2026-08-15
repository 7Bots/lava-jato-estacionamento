import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Search, Plus, Trash2, ArrowLeft, Car } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { computeBilling } from "@/lib/billing";
import { formatCents, formatDateTime, formatDuration } from "@/lib/format";
import {
  formatPlate,
  normalizePlate,
  paymentLabel,
  useActiveTickets,
  useCustomerTickets,
  useCustomers,
  useVehicles,
  type Customer,
} from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes | Doca Lund Estacionamento" },
      { name: "description", content: "Cadastro de clientes, veículos e histórico de visitas." },
      { property: "og:title", content: "Clientes | Doca Lund" },
      { property: "og:description", content: "Clientes, veículos e histórico de visitas." },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  const { data: customers = [], isLoading } = useCustomers();
  const { data: vehicles = [] } = useVehicles();
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const plates = vehicles
        .filter((v) => v.customer_id === c.id)
        .map((v) => v.plate.toLowerCase())
        .join(" ");
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.cpf ?? "").toLowerCase().includes(q) ||
        plates.includes(q.replace(/[^a-z0-9]/g, ""))
      );
    });
  }, [customers, vehicles, search]);

  if (detail) {
    return <CustomerDetail customer={detail} onBack={() => setDetail(null)} />;
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Cadastro, veículos e histórico"
        action={<NewCustomerDialog />}
      />

      <div className="px-4 py-4 md:px-8">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone, CPF ou placa"
            aria-label="Buscar clientes"
            className="min-h-11 pl-9"
          />
        </div>
      </div>

      <div className="px-4 pb-8 md:px-8">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum cliente encontrado"
            description="Os clientes aparecem aqui automaticamente conforme os check-ins são feitos, ou cadastre um manualmente."
          />
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {filtered.map((c) => {
              const plates = vehicles.filter((v) => v.customer_id === c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => setDetail(c)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {c.phone ?? "sem telefone"} ·{" "}
                      {plates.map((v) => formatPlate(v.plate)).join(", ") || "sem veículo"}
                    </p>
                  </div>
                  {c.auto_created && <Badge variant="secondary">Automático</Badge>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function NewCustomerDialog() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [plate, setPlate] = useState("");
  const [type, setType] = useState<"car" | "moto">("car");
  const [saving, setSaving] = useState(false);

  async function save(): Promise<void> {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("customers")
      .insert({
        owner_id: user.id,
        name: name.trim(),
        phone: phone || null,
        cpf: cpf || null,
        email: email || null,
        auto_created: false,
      })
      .select("id")
      .single();
    if (error || !data) {
      setSaving(false);
      toast.error("Não foi possível cadastrar o cliente.");
      return;
    }
    if (plate.trim()) {
      await supabase.from("vehicles").insert({
        owner_id: user.id,
        customer_id: data.id,
        type,
        plate: normalizePlate(plate),
      });
    }
    setSaving(false);
    toast.success("Cliente cadastrado.");
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["vehicles"] });
    setOpen(false);
    setName("");
    setPhone("");
    setCpf("");
    setEmail("");
    setPlate("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="min-h-11">
          <Plus className="size-4" /> Cadastrar cliente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-display text-2xl">Cadastrar cliente</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="cname">Nome *</Label>
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cphone">Telefone</Label>
            <Input id="cphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ccpf">CPF</Label>
            <Input id="ccpf" value={cpf} onChange={(e) => setCpf(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="cemail">E-mail</Label>
            <Input id="cemail" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cplate">Placa do veículo</Label>
            <Input
              id="cplate"
              value={formatPlate(plate)}
              onChange={(e) => setPlate(normalizePlate(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="ctype">Tipo</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["car", "moto"] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={type === t ? "default" : "outline"}
                  onClick={() => setType(t)}
                >
                  {t === "car" ? "Carro" : "Moto"}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <Button className="min-h-11" onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar cliente"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function CustomerDetail({ customer, onBack }: { customer: Customer; onBack: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: vehicles = [] } = useVehicles();
  const { data: history = [], isLoading } = useCustomerTickets(customer.id);
  const { data: activeTickets = [] } = useActiveTickets();

  const myVehicles = vehicles.filter((v) => v.customer_id === customer.id);
  const confirmed = history.filter((t) => t.status === "confirmed");
  const totalSpent = confirmed.reduce((a, t) => a + (t.total_cents ?? 0), 0);
  const avgTime =
    confirmed.length > 0
      ? confirmed.reduce(
          (a, t) =>
            a +
            (new Date(t.checkout_at ?? t.checkin_at).getTime() - new Date(t.checkin_at).getTime()),
          0,
        ) / confirmed.length
      : 0;
  const hasOpen = activeTickets.some((t) => t.customer_id === customer.id);

  async function removeCustomer(): Promise<void> {
    if (hasOpen) {
      toast.error("Este cliente tem uma comanda aberta e não pode ser excluído.");
      return;
    }
    const { error } = await supabase.from("customers").delete().eq("id", customer.id);
    if (error) {
      toast.error("Não foi possível excluir o cliente.");
      return;
    }
    toast.success("Cliente excluído.");
    qc.invalidateQueries({ queryKey: ["customers"] });
    onBack();
  }

  return (
    <>
      <PageHeader
        title={customer.name}
        subtitle={customer.phone ?? "Sem telefone"}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-11" onClick={onBack}>
              <ArrowLeft className="size-4" /> Voltar
            </Button>
            <Button
              className="min-h-11"
              onClick={() => navigate({ to: "/patio", search: { customer: customer.id } })}
            >
              <Car className="size-4" /> Novo check-in
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="min-h-11 text-destructive">
                  <Trash2 className="size-4" /> Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir este cliente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Os veículos vinculados também serão removidos. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={removeCustomer}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 px-4 py-4 md:grid-cols-4 md:px-8">
        <Stat label="Visitas" value={String(confirmed.length)} />
        <Stat label="Total gasto" value={formatCents(totalSpent)} />
        <Stat label="Tempo médio" value={avgTime ? formatDuration(avgTime) : "—"} />
        <Stat
          label="Última visita"
          value={history[0] ? formatDateTime(history[0].checkin_at) : "—"}
        />
      </div>

      <div className="grid gap-6 px-4 pb-8 md:grid-cols-2 md:px-8">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-display mb-3 text-2xl">Dados</h2>
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted-foreground">CPF</dt>
            <dd className="text-right">{customer.cpf ?? "—"}</dd>
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="text-right">{customer.email ?? "—"}</dd>
            <dt className="text-muted-foreground">Observações</dt>
            <dd className="text-right">{customer.notes ?? "—"}</dd>
          </dl>

          <h3 className="text-display mb-2 mt-5 text-xl">Veículos</h3>
          {myVehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum veículo cadastrado.</p>
          ) : (
            <ul className="space-y-2">
              {myVehicles.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span className="text-display text-xl">{formatPlate(v.plate)}</span>
                  <span className="text-muted-foreground">
                    {[v.brand, v.model, v.color].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <Badge variant="outline">{v.type === "car" ? "Carro" : "Moto"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-display mb-3 text-2xl">Histórico de visitas</h2>
          {isLoading ? (
            <Skeleton className="h-32 rounded-lg" />
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma visita registrada.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((t) => {
                const b = computeBilling({
                  checkinAt: new Date(t.checkin_at),
                  checkoutAt: new Date(t.checkout_at ?? t.checkin_at),
                  priceBlockCents: t.price_block_cents,
                  dailyCents: t.daily_cents,
                  blockMinutes: t.block_minutes,
                  graceMinutes: t.grace_minutes,
                  forceDaily: t.force_daily,
                  manualDiscountCents: t.manual_discount_cents,
                });
                return (
                  <li key={t.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold tabular">{formatDateTime(t.checkin_at)}</span>
                      <span className="text-display text-xl text-primary">
                        {formatCents(t.total_cents ?? 0)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Vaga {t.spots?.label ?? "—"}</span>
                      <span>{formatDuration(b.elapsedMs)}</span>
                      <span>{paymentLabel(t.payment_method)}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {statusLabel(t.status)}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function statusLabel(status: string) {
  return (
    { open: "Aberta", checked_out: "Check-out", confirmed: "Confirmada", canceled: "Cancelada" }[
      status
    ] ?? status
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-display text-2xl leading-none text-foreground tabular">{value}</p>
    </div>
  );
}
