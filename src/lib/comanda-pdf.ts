import jsPDF from "jspdf";
import { computeBilling } from "@/lib/billing";
import { formatCents, formatDateTime, formatDuration } from "@/lib/format";
import { formatPlate, paymentLabel, type Settings, type Ticket } from "@/lib/db";

function ticketNumber(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function fileStamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}${p(d.getMonth() + 1)}${d.getFullYear()}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function downloadComandaPdf(ticket: Ticket, settings: Settings | null) {
  const checkin = new Date(ticket.checkin_at);
  const end = ticket.checkout_at ? new Date(ticket.checkout_at) : new Date();
  const billing = computeBilling({
    checkinAt: checkin,
    checkoutAt: end,
    priceBlockCents: ticket.price_block_cents,
    dailyCents: ticket.daily_cents,
    blockMinutes: ticket.block_minutes,
    graceMinutes: ticket.grace_minutes,
    forceDaily: ticket.force_daily,
    manualDiscountCents: ticket.manual_discount_cents,
  });
  const total = ticket.total_cents ?? billing.totalCents;

  const doc = new jsPDF({ unit: "mm", format: [80, 200] });
  const W = 80;
  let y = 10;
  const line = (text: string, opts?: { size?: number; bold?: boolean; align?: "center" }) => {
    doc.setFontSize(opts?.size ?? 9);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    if (opts?.align === "center") doc.text(text, W / 2, y, { align: "center" });
    else doc.text(text, 6, y);
    y += (opts?.size ?? 9) * 0.45 + 2;
  };
  const rule = () => {
    doc.setDrawColor(180);
    doc.line(6, y, W - 6, y);
    y += 4;
  };

  line((settings?.business_name || "DOCA LUND ESTACIONAMENTO").toUpperCase(), {
    size: 13,
    bold: true,
    align: "center",
  });
  if (settings?.business_doc) line(`CNPJ/CPF: ${settings.business_doc}`, { align: "center" });
  if (settings?.business_phone) line(`Tel: ${settings.business_phone}`, { align: "center" });
  y += 1;
  rule();

  line(`Comanda nº ${ticketNumber(ticket.id)}`, { bold: true });
  line(`Cliente: ${ticket.customers?.name ?? "—"}`);
  line(`Telefone: ${ticket.customers?.phone ?? "—"}`);
  rule();

  line(`Veículo: ${ticket.vehicle_type === "car" ? "Carro" : "Moto"}`);
  line(`Placa: ${formatPlate(ticket.plate)}`, { bold: true });
  line(`Modelo: ${ticket.vehicles?.model ?? "—"}   Cor: ${ticket.vehicles?.color ?? "—"}`);
  line(`Vaga: ${ticket.spots?.label ?? "—"}`);
  rule();

  line(`Entrada: ${formatDateTime(checkin)}`);
  line(
    `Saída: ${ticket.checkout_at ? formatDateTime(ticket.checkout_at) : "em aberto"}`,
  );
  line(`Tempo: ${formatDuration(billing.elapsedMs)}`);
  rule();

  if (billing.daysCharged > 0)
    line(`${billing.daysCharged} diária(s) x ${formatCents(ticket.daily_cents)}`);
  if (billing.blocksCharged > 0)
    line(`${billing.blocksCharged} bloco(s) x ${formatCents(ticket.price_block_cents)}`);
  line(`Subtotal: ${formatCents(billing.subtotalCents)}`);
  if (ticket.manual_discount_cents > 0)
    line(`Desconto: -${formatCents(ticket.manual_discount_cents)}`);
  line(`Pagamento: ${paymentLabel(ticket.payment_method)}`);
  y += 2;
  rule();

  line("VALOR A PAGAR", { size: 11, bold: true, align: "center" });
  line(formatCents(total), { size: 18, bold: true, align: "center" });
  y += 4;
  line("Obrigado pela preferência!", { size: 8, align: "center" });

  doc.save(`comanda-${ticket.plate}-${fileStamp(checkin)}.pdf`);
}
