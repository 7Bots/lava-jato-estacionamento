import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, LogOut, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { computeBilling } from "@/lib/billing";
import { downloadComandaPdf } from "@/lib/comanda-pdf";
import { useNow } from "@/lib/tick";
import {
  PAYMENT_METHODS,
  formatPlate,
  type Settings,
  type Ticket,
} from "@/lib/db";
import { centsToReaisInput, formatCents, formatDateTime, formatDuration, parseReaisToCents } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function ComandaDialog({
  ticket,
  settings,
  open,
  onOpenChange,
}: {
  ticket: Ticket | null;
  settings: Settings | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const now = useNow();
  const [forceDaily, setForceDaily] = useState(false);
  const [discount, setDiscount] = useState("0,00");
  const [payment, setPayment] = useState<string>("dinheiro");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ticket) return;
    setForceDaily(ticket.force_daily);
    setDiscount(centsToReaisInput(ticket.manual_discount_cents));
    setPayment(ticket.payment_method ?? "dinheiro");
  }, [ticket?.id, open]);

  const discountCents = parseReaisToCents(discount);
  const isOpen = ticket?.status === "open";

  const billing = useMemo(() => {
    if (!ticket) return null;
    const end = ticket.checkout_at ? new Date(ticket.checkout_at) : new Date(now);
    return computeBilling({
      checkinAt: new Date(ticket.checkin_at),
      checkoutAt: end,
      priceBlockCents: ticket.price_block_cents,
      dailyCents: ticket.daily_cents,
      blockMinutes: ticket.block_minutes,
      graceMinutes: ticket.grace_minutes,
      forceDaily,
      manualDiscountCents: discountCents,
    });
  }, [ticket, now, forceDaily, discountCents]);

  if (!ticket || !billing) return null;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["tickets"] });
    qc.invalidateQueries({ queryKey: ["spots"] });
  }

  async function persistControls() {
    await supabase
      .from("tickets")
      .update({
        force_daily: forceDaily,
        manual_discount_cents: discountCents,
        payment_method: payment,
      })
      .eq("id", ticket!.id);
  }

  async function handleCheckout(): Promise<void> {
    setBusy(true);
    const { error } = await supabase
      .from("tickets")
      .update({
        status: "checked_out",
        checkout_at: new Date().toISOString(),
        force_daily: forceDaily,
        manual_discount_cents: discountCents,
        payment_method: payment,
        total_cents: billing!.totalCents,
      })
      .eq("id", ticket!.id);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível fazer o check-out.");
      return;
    }
    toast.success("Check-out realizado. Confirme o serviço para liberar a vaga.");
    invalidate();
  }

  async function handleConfirm(): Promise<void> {
    setBusy(true);
    const nowISO = new Date().toISOString();
    const { error } = await supabase
      .from("tickets")
      .update({
        status: "confirmed",
        confirmed_at: nowISO,
        checkout_at: ticket!.checkout_at ?? nowISO,
        force_daily: forceDaily,
        manual_discount_cents: discountCents,
        payment_method: payment,
        total_cents: ticket!.total_cents ?? billing!.totalCents,
      })
      .eq("id", ticket!.id);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível confirmar o serviço.");
      return;
    }
    toast.success("Serviço confirmado. Vaga liberada!");
    invalidate();
    onOpenChange(false);
  }

  async function handleCancel(): Promise<void> {
    setBusy(true);
    const { error } = await supabase
      .from("tickets")
      .update({ status: "canceled", checkout_at: new Date().toISOString(), total_cents: 0 })
      .eq("id", ticket!.id);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível cancelar a comanda.");
      return;
    }
    toast.success("Comanda cancelada. Vaga liberada.");
    invalidate();
    onOpenChange(false);
  }

  const total = ticket.status === "checked_out" ? (ticket.total_cents ?? billing.totalCents) : billing.totalCents;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Comanda {ticket.plate}</DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-dashed border-border bg-card p-4">
          <div className="flex flex-col items-center text-center">
            <Logo className="h-24 w-auto" />
            <p className="text-display mt-2 text-xl leading-none">
              {settings?.business_name || "BelParking"}
            </p>
            {settings?.business_doc && (
              <p className="text-xs text-muted-foreground">CNPJ/CPF: {settings.business_doc}</p>
            )}
            {settings?.business_phone && (
              <p className="text-xs text-muted-foreground">Tel: {settings.business_phone}</p>
            )}
          </div>

          <div className="my-3 border-t border-dashed border-border" />

          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Comanda nº</dt>
            <dd className="text-right font-semibold">{ticket.id.slice(0, 8).toUpperCase()}</dd>
            <dt className="text-muted-foreground">Cliente</dt>
            <dd className="text-right font-semibold">{ticket.customers?.name ?? "—"}</dd>
            <dt className="text-muted-foreground">Telefone</dt>
            <dd className="text-right">{ticket.customers?.phone ?? "—"}</dd>
            <dt className="text-muted-foreground">Veículo</dt>
            <dd className="text-right">{ticket.vehicle_type === "car" ? "Carro" : "Moto"}</dd>
            <dt className="text-muted-foreground">Placa</dt>
            <dd className="text-right font-bold">{formatPlate(ticket.plate)}</dd>
            <dt className="text-muted-foreground">Modelo / Cor</dt>
            <dd className="text-right">
              {ticket.vehicles?.model ?? "—"} / {ticket.vehicles?.color ?? "—"}
            </dd>
            <dt className="text-muted-foreground">Vaga</dt>
            <dd className="text-right font-semibold">{ticket.spots?.label ?? "—"}</dd>
            <dt className="text-muted-foreground">Entrada</dt>
            <dd className="text-right tabular">{formatDateTime(ticket.checkin_at)}</dd>
            <dt className="text-muted-foreground">Saída</dt>
            <dd className="text-right tabular">
              {ticket.checkout_at ? formatDateTime(ticket.checkout_at) : "em aberto"}
            </dd>
            <dt className="text-muted-foreground">Tempo</dt>
            <dd className="text-right tabular">{formatDuration(billing.elapsedMs)}</dd>
          </dl>

          <div className="my-3 border-t border-dashed border-border" />

          <div className="space-y-1 text-sm">
            {billing.daysCharged > 0 && (
              <Row
                label={`${billing.daysCharged} diária(s) × ${formatCents(ticket.daily_cents)}`}
                value={formatCents(billing.daysCharged * ticket.daily_cents)}
              />
            )}
            {billing.blocksCharged > 0 && (
              <Row
                label={`${billing.blocksCharged} bloco(s) × ${formatCents(ticket.price_block_cents)}`}
                value={formatCents(
                  Math.min(billing.blocksCharged * ticket.price_block_cents, ticket.daily_cents),
                )}
              />
            )}
            {discountCents > 0 && (
              <Row label="Desconto" value={`- ${formatCents(discountCents)}`} />
            )}
            {billing.isDailyApplied && (
              <Badge className="bg-warning text-warning-foreground">Diária aplicada</Badge>
            )}
          </div>

          <div className="mt-4 rounded-lg bg-accent px-4 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-foreground">
              Valor a pagar
            </p>
            <p className="text-display text-5xl leading-none text-primary tabular">
              {formatCents(total)}
            </p>
          </div>
        </div>

        {ticket.status !== "confirmed" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="daily" className="font-semibold">
                Aplicar diária
              </Label>
              <Switch id="daily" checked={forceDaily} onCheckedChange={setForceDaily} disabled={!isOpen} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="discount">Desconto (R$)</Label>
                <Input
                  id="discount"
                  inputMode="decimal"
                  value={discount}
                  disabled={!isOpen}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="payment">Forma de pagamento</Label>
                <Select value={payment} onValueChange={setPayment}>
                  <SelectTrigger id="payment" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            className="min-h-11"
            onClick={async () => {
              if (ticket.status !== "confirmed") await persistControls();
              downloadComandaPdf(
                { ...ticket, force_daily: forceDaily, manual_discount_cents: discountCents, payment_method: payment },
                settings,
              );
            }}
          >
            <Download className="size-4" /> Baixar comanda (PDF)
          </Button>

          {isOpen && (
            <Button className="min-h-11" onClick={handleCheckout} disabled={busy}>
              <LogOut className="size-4" /> Fazer check-out
            </Button>
          )}

          {ticket.status !== "confirmed" && (
            <Button
              className="min-h-11 bg-free text-free-foreground hover:bg-free/90"
              onClick={handleConfirm}
              disabled={busy}
            >
              <CheckCircle2 className="size-4" /> Confirmar serviço
            </Button>
          )}

          {ticket.status !== "confirmed" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="min-h-11 text-destructive">
                  <XCircle className="size-4" /> Cancelar comanda
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar esta comanda?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A vaga será liberada e o valor não entrará no faturamento. Esta ação não pode ser
                    desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancel}>Cancelar comanda</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular">{value}</span>
    </div>
  );
}
