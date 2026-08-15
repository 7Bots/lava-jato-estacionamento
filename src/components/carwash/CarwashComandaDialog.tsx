import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCents, formatDateTime, centsToReaisInput, parseReaisToCents } from "@/lib/format";
import { PAYMENT_METHODS, formatPlate, paymentLabel, useSettings } from "@/lib/db";
import { ticketServices, vehicleTypeLabel, type CarwashTicket } from "@/lib/carwash";
import { downloadCarwashComandaPdf } from "@/lib/carwash-pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CarwashComandaDialog({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: CarwashTicket | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: settings = null } = useSettings();
  if (!ticket) return null;
  const services = ticketServices(ticket);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-display text-2xl">
            Comanda — {formatPlate(ticket.plate)}
          </DialogTitle>
          <DialogDescription>
            {ticket.customers?.name ?? "Cliente"} · {vehicleTypeLabel(ticket.vehicle_type)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Info label="Telefone" value={ticket.customers?.phone ?? "—"} />
            <Info label="Modelo / Cor" value={`${ticket.vehicles?.model ?? "—"} · ${ticket.vehicles?.color ?? "—"}`} />
            <Info label="Entrada" value={formatDateTime(ticket.arrived_at)} />
            <Info
              label="Início"
              value={ticket.started_at ? formatDateTime(ticket.started_at) : "—"}
            />
            <Info
              label="Conclusão"
              value={ticket.completed_at ? formatDateTime(ticket.completed_at) : "—"}
            />
            <Info label="Pagamento" value={paymentLabel(ticket.payment_method)} />
          </div>

          <div className="rounded-xl border border-border">
            {services.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between border-b border-border px-3 py-2 last:border-0"
              >
                <span>{s.name_snapshot}</span>
                <span className="tabular">{formatCents(s.price_cents_snapshot)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular">{formatCents(ticket.subtotal_cents)}</span>
            </div>
            {ticket.manual_discount_cents > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Desconto</span>
                <span className="tabular">-{formatCents(ticket.manual_discount_cents)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-primary px-4 py-3 text-primary-foreground">
            <span className="text-sm font-semibold uppercase">Valor a pagar</span>
            <span className="text-display text-4xl leading-none tabular">
              {formatCents(ticket.total_cents)}
            </span>
          </div>

          {ticket.stage !== "concluido" && (
            <Badge variant="outline">Valor entra no faturamento ao concluir</Badge>
          )}

          <Button
            variant="outline"
            className="min-h-11 w-full"
            onClick={() => downloadCarwashComandaPdf(ticket, settings)}
          >
            <Download className="size-4" /> Baixar comanda (PDF)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

export function CarwashPaymentDialog({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: CarwashTicket | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [method, setMethod] = useState("dinheiro");
  const [discount, setDiscount] = useState("0,00");
  const [saving, setSaving] = useState(false);
  if (!ticket) return null;

  const discountCents = Math.min(parseReaisToCents(discount), ticket.subtotal_cents);
  const total = ticket.subtotal_cents - discountCents;

  async function confirm(): Promise<void> {
    if (!ticket) return;
    setSaving(true);
    const { error } = await supabase
      .from("carwash_tickets")
      .update({
        stage: "concluido",
        completed_at: ticket.completed_at ?? new Date().toISOString(),
        manual_discount_cents: discountCents,
        total_cents: total,
        payment_method: method,
      })
      .eq("id", ticket.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível concluir a ordem.");
      return;
    }
    toast.success(`Ordem concluída — ${formatCents(total)}`);
    qc.invalidateQueries({ queryKey: ["carwash_tickets"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-display text-2xl">
            Pagamento — {formatPlate(ticket.plate)}
          </DialogTitle>
          <DialogDescription>Confirme para lançar no faturamento do lava-jato.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="cwpay">Forma de pagamento</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger id="cwpay" className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cwdisc">Desconto (R$)</Label>
            <Input
              id="cwdisc"
              inputMode="decimal"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="min-h-11"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Subtotal {formatCents(ticket.subtotal_cents)} · máx.{" "}
              {centsToReaisInput(ticket.subtotal_cents)}
            </p>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-primary px-4 py-3 text-primary-foreground">
            <span className="text-sm font-semibold uppercase">Total</span>
            <span className="text-display text-4xl leading-none tabular">
              {formatCents(total)}
            </span>
          </div>
          <Button className="min-h-12" onClick={confirm} disabled={saving}>
            {saving ? "Confirmando..." : "Confirmar e concluir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
