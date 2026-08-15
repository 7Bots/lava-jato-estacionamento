import { motion } from "framer-motion";
import { Car, Bike, Receipt, LogOut } from "lucide-react";
import { blockProgress, computeBilling } from "@/lib/billing";
import { useNow } from "@/lib/tick";
import { formatCents, formatClock, formatCountdown } from "@/lib/format";
import { formatPlate, type Ticket } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function TicketCard({
  ticket,
  onOpenComanda,
}: {
  ticket: Ticket;
  onOpenComanda: (t: Ticket) => void;
}) {
  const now = useNow();
  const end = ticket.checkout_at ? new Date(ticket.checkout_at) : new Date(now);
  const billing = computeBilling({
    checkinAt: new Date(ticket.checkin_at),
    checkoutAt: end,
    priceBlockCents: ticket.price_block_cents,
    dailyCents: ticket.daily_cents,
    blockMinutes: ticket.block_minutes,
    graceMinutes: ticket.grace_minutes,
    forceDaily: ticket.force_daily,
    manualDiscountCents: ticket.manual_discount_cents,
  });
  const Icon = ticket.vehicle_type === "car" ? Car : Bike;
  const total = ticket.status === "checked_out" ? (ticket.total_cents ?? billing.totalCents) : billing.totalCents;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-xl border border-border bg-card p-4 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="size-5 text-secondary" />
            <span className="text-display text-3xl leading-none">{formatPlate(ticket.plate)}</span>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {ticket.customers?.name ?? "Cliente"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="secondary">{ticket.spots?.label ?? "—"}</Badge>
          {ticket.status === "checked_out" && (
            <Badge className="bg-warning text-warning-foreground">Check-out feito</Badge>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Tempo</p>
          <p className="text-2xl font-bold tabular">{formatClock(billing.elapsedMs)}</p>
        </div>
        <motion.div
          key={total}
          initial={{ scale: 1.12 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="text-right"
        >
          <p className="text-xs uppercase text-muted-foreground">Valor</p>
          <p className="text-display text-3xl leading-none text-primary tabular">
            {formatCents(total)}
          </p>
        </motion.div>
      </div>

      {ticket.status === "open" &&
        (billing.msToNextBlock == null ? (
          <div className="mt-3">
            <Badge className="bg-warning text-warning-foreground">Diária aplicada</Badge>
          </div>
        ) : (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-secondary transition-[width] duration-1000 ease-linear"
                style={{ width: `${blockProgress(billing, ticket.block_minutes) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground tabular">
              Próximo bloco em {formatCountdown(billing.msToNextBlock)}
            </p>
          </div>
        ))}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" className="min-h-11" onClick={() => onOpenComanda(ticket)}>
          <Receipt className="size-4" /> Comanda
        </Button>
        <Button className="min-h-11" onClick={() => onOpenComanda(ticket)}>
          <LogOut className="size-4" /> Check-out
        </Button>
      </div>
    </motion.article>
  );
}
