import jsPDF from "jspdf";
import { formatCents, formatDateTime } from "@/lib/format";
import { formatPlate, paymentLabel, type Settings } from "@/lib/db";
import { ticketServices, vehicleTypeLabel, type CarwashTicket } from "@/lib/carwash";

function fileStamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}${p(d.getMonth() + 1)}${d.getFullYear()}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function downloadCarwashComandaPdf(ticket: CarwashTicket, settings: Settings | null) {
  const doc = new jsPDF({ unit: "mm", format: [80, 220] });
  const W = 80;
  let y = 10;
  const line = (text: string, opts?: { size?: number; bold?: boolean; align?: "center" }) => {
    doc.setFontSize(opts?.size ?? 9);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    if (opts?.align === "center") doc.text(text, W / 2, y, { align: "center" });
    else doc.text(text, 6, y);
    y += (opts?.size ?? 9) * 0.45 + 2;
  };
  const row = (left: string, right: string) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(left, 6, y);
    doc.text(right, W - 6, y, { align: "right" });
    y += 6;
  };
  const rule = () => {
    doc.setDrawColor(180);
    doc.line(6, y, W - 6, y);
    y += 4;
  };

  line((settings?.business_name || "DOCA LUND").toUpperCase(), {
    size: 13,
    bold: true,
    align: "center",
  });
  line("LAVA-JATO", { size: 10, bold: true, align: "center" });
  if (settings?.business_doc) line(`CNPJ/CPF: ${settings.business_doc}`, { align: "center" });
  if (settings?.business_phone) line(`Tel: ${settings.business_phone}`, { align: "center" });
  y += 1;
  rule();

  line(`Ordem nº ${ticket.id.slice(0, 8).toUpperCase()}`, { bold: true });
  line(`Cliente: ${ticket.customers?.name ?? "—"}`);
  line(`Telefone: ${ticket.customers?.phone ?? "—"}`);
  rule();

  line(`Veículo: ${vehicleTypeLabel(ticket.vehicle_type)}`);
  line(`Placa: ${formatPlate(ticket.plate)}`, { bold: true });
  line(`Modelo: ${ticket.vehicles?.model ?? "—"}   Cor: ${ticket.vehicles?.color ?? "—"}`);
  rule();

  line("SERVIÇOS", { bold: true });
  ticketServices(ticket).forEach((s) => row(s.name_snapshot, formatCents(s.price_cents_snapshot)));
  rule();
  row("Subtotal", formatCents(ticket.subtotal_cents));
  if (ticket.manual_discount_cents > 0)
    row("Desconto", `-${formatCents(ticket.manual_discount_cents)}`);
  rule();

  line(`Entrada: ${formatDateTime(ticket.arrived_at)}`);
  line(`Início: ${ticket.started_at ? formatDateTime(ticket.started_at) : "—"}`);
  line(`Conclusão: ${ticket.completed_at ? formatDateTime(ticket.completed_at) : "—"}`);
  line(`Pagamento: ${paymentLabel(ticket.payment_method)}`);
  y += 2;
  rule();

  line("VALOR A PAGAR", { size: 11, bold: true, align: "center" });
  line(formatCents(ticket.total_cents), { size: 18, bold: true, align: "center" });
  y += 4;
  line("Obrigado pela preferência!", { size: 8, align: "center" });

  doc.save(`comanda-lavajato-${ticket.plate}-${fileStamp(new Date(ticket.arrived_at))}.pdf`);
}
