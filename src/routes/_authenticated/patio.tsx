import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Car, Plus } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { CheckinForm } from "@/components/CheckinForm";
import { ComandaDialog } from "@/components/ComandaDialog";
import { TicketCard } from "@/components/TicketCard";
import {
  useActiveTickets,
  useConfirmedTickets,
  useRealtimeSync,
  useSettings,
  useSpots,
  type Ticket,
} from "@/lib/db";
import { formatCents } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/patio")({
  head: () => ({
    meta: [
      { title: "Pátio | BelParking" },
      { name: "description", content: "Check-in de veículos e acompanhamento ao vivo do pátio." },
      { property: "og:title", content: "Pátio | BelParking" },
      { property: "og:description", content: "Check-in de veículos e pátio ao vivo." },
    ],
  }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { spot?: string | undefined; customer?: string | undefined } => ({
    spot: typeof search['spot'] === "string" ? (search['spot'] as string) : undefined,
    customer: typeof search['customer'] === "string" ? (search['customer'] as string) : undefined,
  }),
  component: PatioPage,
});

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

function PatioPage() {
  useRealtimeSync();
  const { spot: spotParam, customer: customerParam } = Route.useSearch();
  const { data: settings } = useSettings();
  const { data: spots = [] } = useSpots();
  const { data: tickets = [], isLoading } = useActiveTickets();
  const { from, to } = useMemo(todayRange, []);
  const { data: confirmedToday = [] } = useConfirmedTickets(from, to);

  const [selected, setSelected] = useState<Ticket | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const occupied = new Set(tickets.map((t) => t.spot_id).filter(Boolean) as string[]);
  const freeCar = spots.filter((s) => s.type === "car" && s.active && !occupied.has(s.id)).length;
  const freeMoto = spots.filter((s) => s.type === "moto" && s.active && !occupied.has(s.id)).length;
  const revenueToday = confirmedToday.reduce((acc, t) => acc + (t.total_cents ?? 0), 0);

  const current = selected ? (tickets.find((t) => t.id === selected.id) ?? selected) : null;

  return (
    <>
      <PageHeader
        title="Registro"
        subtitle="Check-in e veículos no pátio"
        action={
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button className="min-h-11 md:hidden">
                <Plus className="size-4" /> Novo check-in
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[92vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-display text-2xl">Novo check-in</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-8">
                <CheckinForm
                  settings={settings ?? null}
                  spots={spots}
                  activeTickets={tickets}
                  defaultSpotId={spotParam ?? null}
                  defaultCustomerId={customerParam ?? null}
                  onDone={() => setSheetOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
        }
      />

      <div className="grid grid-cols-2 gap-3 px-4 py-4 md:grid-cols-4 md:px-8">
        <Stat label="Vagas livres — carro" value={String(freeCar)} />
        <Stat label="Vagas livres — moto" value={String(freeMoto)} />
        <Stat label="Veículos no pátio" value={String(tickets.length)} />
        <Stat label="Receita confirmada hoje" value={formatCents(revenueToday)} />
      </div>

      <div className="grid gap-6 px-4 pb-8 md:grid-cols-[minmax(0,420px)_1fr] md:px-8">
        <section className="hidden rounded-xl border border-border bg-card p-5 md:block">
          <h2 className="text-display mb-4 text-2xl">Novo check-in</h2>
          <CheckinForm
            settings={settings ?? null}
            spots={spots}
            activeTickets={tickets}
            defaultSpotId={spotParam ?? null}
            defaultCustomerId={customerParam ?? null}
          />
        </section>

        <section>
          <h2 className="text-display mb-3 text-2xl">Pátio atual</h2>
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-52 rounded-xl" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <EmptyState
              icon={Car}
              title="Pátio vazio"
              description="Faça o primeiro check-in para acompanhar o tempo e o valor ao vivo."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {tickets.map((t) => (
                  <TicketCard key={t.id} ticket={t} onOpenComanda={setSelected} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-display text-3xl leading-none text-foreground tabular">{value}</p>
    </div>
  );
}
