import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { LayoutGrid, Search } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { ComandaDialog } from "@/components/ComandaDialog";
import { computeBilling } from "@/lib/billing";
import { useNow } from "@/lib/tick";
import { formatCents, formatClock } from "@/lib/format";
import {
  formatPlate,
  useActiveTickets,
  useRealtimeSync,
  useSettings,
  useSpots,
  type Spot,
  type Ticket,
} from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/vagas")({
  head: () => ({
    meta: [
      { title: "Vagas | BelParking" },
      { name: "description", content: "Mapa interativo das vagas livres e ocupadas em tempo real." },
      { property: "og:title", content: "Vagas | BelParking" },
      { property: "og:description", content: "Mapa de vagas em tempo real." },
    ],
  }),
  component: VagasPage,
});

type Filter = "todas" | "livres" | "ocupadas";

function VagasPage() {
  useRealtimeSync();
  const navigate = useNavigate();
  const { data: spots = [], isLoading } = useSpots();
  const { data: tickets = [] } = useActiveTickets();
  const { data: settings } = useSettings();
  const [filter, setFilter] = useState<Filter>("todas");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Ticket | null>(null);

  const bySpot = useMemo(() => {
    const map = new Map<string, Ticket>();
    tickets.forEach((t) => t.spot_id && map.set(t.spot_id, t));
    return map;
  }, [tickets]);

  const current = selected ? (tickets.find((t) => t.id === selected.id) ?? null) : null;

  function visible(list: Spot[]) {
    return list.filter((s) => {
      const t = bySpot.get(s.id);
      if (filter === "livres" && (t || !s.active)) return false;
      if (filter === "ocupadas" && !t) return false;
      return true;
    });
  }

  const cars = spots.filter((s) => s.type === "car");
  const motos = spots.filter((s) => s.type === "moto");

  return (
    <>
      <PageHeader title="Vagas" subtitle="Mapa do estacionamento em tempo real" />

      <div className="flex flex-wrap items-center gap-2 px-4 py-4 md:px-8">
        {(["todas", "livres", "ocupadas"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm font-semibold capitalize transition-colors",
              filter === f
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            {f}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por placa"
            aria-label="Buscar por placa"
            className="min-h-11 pl-9"
          />
        </div>
      </div>

      <div className="space-y-8 px-4 pb-8 md:px-8">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : spots.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title="Nenhuma vaga cadastrada"
            description="Cadastre a quantidade de vagas em Configurações para montar o mapa do pátio."
          />
        ) : (
          <>
            <SpotSection
              title="Vagas de Carro"
              spots={visible(cars)}
              total={cars.length}
              occupiedCount={cars.filter((s) => bySpot.has(s.id)).length}
              bySpot={bySpot}
              search={search}
              onFree={(s) => navigate({ to: "/patio", search: { spot: s.id } })}
              onOccupied={setSelected}
            />
            <SpotSection
              title="Vagas de Moto"
              spots={visible(motos)}
              total={motos.length}
              occupiedCount={motos.filter((s) => bySpot.has(s.id)).length}
              bySpot={bySpot}
              search={search}
              onFree={(s) => navigate({ to: "/patio", search: { spot: s.id } })}
              onOccupied={setSelected}
            />
          </>
        )}
      </div>

      <ComandaDialog
        ticket={current}
        settings={settings ?? null}
        open={!!current}
        onOpenChange={(v) => !v && setSelected(null)}
      />
    </>
  );
}

function SpotSection({
  title,
  spots,
  total,
  occupiedCount,
  bySpot,
  search,
  onFree,
  onOccupied,
}: {
  title: string;
  spots: Spot[];
  total: number;
  occupiedCount: number;
  bySpot: Map<string, Ticket>;
  search: string;
  onFree: (s: Spot) => void;
  onOccupied: (t: Ticket) => void;
}) {
  if (total === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-display text-2xl">{title}</h2>
        <span className="text-sm text-muted-foreground tabular">
          {occupiedCount}/{total} ocupadas
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {spots.map((s) => (
          <SpotCard
            key={s.id}
            spot={s}
            ticket={bySpot.get(s.id) ?? null}
            search={search}
            onFree={onFree}
            onOccupied={onOccupied}
          />
        ))}
      </div>
    </section>
  );
}

function SpotCard({
  spot,
  ticket,
  search,
  onFree,
  onOccupied,
}: {
  spot: Spot;
  ticket: Ticket | null;
  search: string;
  onFree: (s: Spot) => void;
  onOccupied: (t: Ticket) => void;
}) {
  const now = useNow();
  const highlighted =
    !!search.trim() && !!ticket && ticket.plate.includes(search.toUpperCase().replace(/[^A-Z0-9]/g, ""));

  if (!spot.active) {
    return (
      <motion.div
        layout
        className="flex h-28 flex-col items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground"
      >
        <span className="text-display text-2xl">{spot.label}</span>
        <span className="text-xs">Manutenção</span>
      </motion.div>
    );
  }

  if (!ticket) {
    return (
      <motion.button
        layout
        onClick={() => onFree(spot)}
        className="group flex h-28 flex-col items-center justify-center rounded-xl border border-free/40 bg-free/10 transition-all hover:scale-[1.03] hover:bg-free/20 hover:shadow-lift"
        aria-label={`Vaga ${spot.label} livre`}
      >
        <motion.span
          animate={{ opacity: [0.65, 1, 0.65] }}
          transition={{ duration: 2.6, repeat: Infinity }}
          className="text-display text-3xl text-free"
        >
          {spot.label}
        </motion.span>
        <span className="text-xs font-semibold text-free">Livre</span>
      </motion.button>
    );
  }

  const billing = computeBilling({
    checkinAt: new Date(ticket.checkin_at),
    checkoutAt: ticket.checkout_at ? new Date(ticket.checkout_at) : new Date(now),
    priceBlockCents: ticket.price_block_cents,
    dailyCents: ticket.daily_cents,
    blockMinutes: ticket.block_minutes,
    graceMinutes: ticket.grace_minutes,
    forceDaily: ticket.force_daily,
    manualDiscountCents: ticket.manual_discount_cents,
  });

  return (
    <motion.button
      layout
      onClick={() => onOccupied(ticket)}
      aria-label={`Vaga ${spot.label} ocupada por ${ticket.plate}`}
      className={cn(
        "flex h-28 flex-col items-center justify-center rounded-xl border p-2 text-center transition-all hover:scale-[1.03] hover:shadow-lift",
        billing.isDailyApplied
          ? "border-warning bg-warning/15"
          : "border-occupied/40 bg-occupied/10",
        highlighted && "ring-2 ring-ring ring-offset-2",
      )}
    >
      <span className="text-display text-2xl leading-none text-occupied">
        {formatPlate(ticket.plate)}
      </span>
      <span className="w-full truncate text-xs text-muted-foreground">
        {ticket.customers?.name?.split(" ")[0] ?? spot.label}
      </span>
      <span className="mt-1 text-sm font-bold tabular">{formatClock(billing.elapsedMs)}</span>
      <span className="text-xs font-semibold text-primary tabular">
        {formatCents(ticket.total_cents ?? billing.totalCents)}
      </span>
      {billing.isDailyApplied && (
        <Badge className="mt-1 bg-warning px-1.5 py-0 text-[10px] text-warning-foreground">
          Diária
        </Badge>
      )}
    </motion.button>
  );
}
