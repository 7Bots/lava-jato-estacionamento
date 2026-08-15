import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Timer, TrendingUp, Wallet, Receipt } from "lucide-react";
import { formatCents, formatDate } from "@/lib/format";
import { paymentLabel, useExpenses } from "@/lib/db";
import { useCarwashCompleted, ticketServices, vehicleTypeLabel } from "@/lib/carwash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { isoDate } from "@/components/ExpensesPanel";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function CarwashDashboard() {
  const firstDay = useMemo(() => {
    const d = new Date();
    return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
  }, []);
  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(isoDate(new Date()));

  const fromISO = new Date(`${from}T00:00:00`).toISOString();
  const toISO = new Date(`${to}T23:59:59`).toISOString();

  const { data: tickets = [], isLoading } = useCarwashCompleted(fromISO, toISO);
  const { data: expenses = [] } = useExpenses(from, to, "carwash");

  const gross = tickets.reduce((a, t) => a + (t.total_cents || 0), 0);
  const expenseTotal = expenses.reduce((a, e) => a + e.amount_cents, 0);
  const net = gross - expenseTotal;
  const avgTicket = tickets.length ? Math.round(gross / tickets.length) : 0;

  const avgServiceMs = useMemo(() => {
    const durations = tickets
      .filter((t) => t.started_at && t.completed_at)
      .map((t) => new Date(t.completed_at!).getTime() - new Date(t.started_at!).getTime());
    if (!durations.length) return 0;
    return durations.reduce((a, b) => a + b, 0) / durations.length;
  }, [tickets]);

  const byDay = useMemo(() => {
    const map = new Map<string, { receita: number; despesa: number }>();
    tickets.forEach((t) => {
      const key = (t.completed_at ?? "").slice(0, 10);
      const cur = map.get(key) ?? { receita: 0, despesa: 0 };
      cur.receita += (t.total_cents || 0) / 100;
      map.set(key, cur);
    });
    expenses.forEach((e) => {
      const cur = map.get(e.date) ?? { receita: 0, despesa: 0 };
      cur.despesa += e.amount_cents / 100;
      map.set(e.date, cur);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date: formatDate(`${date}T12:00:00`).slice(0, 5), ...v }));
  }, [tickets, expenses]);

  const byService = useMemo(() => {
    const map = new Map<string, number>();
    tickets.forEach((t) =>
      ticketServices(t).forEach((s) => {
        map.set(s.name_snapshot, (map.get(s.name_snapshot) ?? 0) + s.price_cents_snapshot / 100);
      }),
    );
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [tickets]);

  const byPayment = useMemo(() => {
    const map = new Map<string, number>();
    tickets.forEach((t) => {
      const key = paymentLabel(t.payment_method);
      map.set(key, (map.get(key) ?? 0) + (t.total_cents || 0) / 100);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const byVehicle = useMemo(() => {
    const map = new Map<string, number>();
    tickets.forEach((t) => {
      const key = vehicleTypeLabel(t.vehicle_type);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  function exportCsv() {
    const rows = [
      ["Data", "Placa", "Cliente", "Veículo", "Serviços", "Pagamento", "Total"],
      ...tickets.map((t) => [
        t.completed_at ? formatDate(t.completed_at) : "",
        t.plate,
        t.customers?.name ?? "",
        vehicleTypeLabel(t.vehicle_type),
        ticketServices(t)
          .map((s) => s.name_snapshot)
          .join(" | "),
        paymentLabel(t.payment_method),
        (t.total_cents / 100).toFixed(2).replace(".", ","),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lavajato-${from}-a-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hours = Math.floor(avgServiceMs / 3600000);
  const mins = Math.round((avgServiceMs % 3600000) / 60000);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-end gap-3 pt-4">
        <div>
          <Label htmlFor="cw-from">De</Label>
          <Input
            id="cw-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="min-h-11"
          />
        </div>
        <div>
          <Label htmlFor="cw-to">Até</Label>
          <Input
            id="cw-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="min-h-11"
          />
        </div>
        <Button variant="outline" className="min-h-11" onClick={exportCsv}>
          <Download className="size-4" /> Exportar CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={TrendingUp} label="Faturamento bruto" value={formatCents(gross)} />
          <Kpi icon={Receipt} label="Despesas" value={formatCents(expenseTotal)} />
          <Kpi icon={Wallet} label="Lucro líquido" value={formatCents(net)} highlight />
          <Kpi
            icon={Timer}
            label="Tempo médio de atendimento"
            value={avgServiceMs ? `${hours}h ${mins}min` : "—"}
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Kpi icon={TrendingUp} label="Ordens concluídas" value={String(tickets.length)} />
        <Kpi icon={Wallet} label="Ticket médio" value={formatCents(avgTicket)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Receita x Despesa por dia">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v: number) => formatCents(Math.round(v * 100))} />
              <Line type="monotone" dataKey="receita" stroke="var(--chart-1)" strokeWidth={2} />
              <Line type="monotone" dataKey="despesa" stroke="var(--chart-3)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Serviços mais vendidos">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byService}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" fontSize={11} interval={0} angle={-15} height={50} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v: number) => formatCents(Math.round(v * 100))} />
              <Bar dataKey="value" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Formas de pagamento">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byPayment} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
                {byPayment.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCents(Math.round(v * 100))} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Ordens por tipo de veículo">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byVehicle}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
        <Icon className="size-4" /> {label}
      </div>
      <p
        className={`text-display mt-1 text-3xl leading-none tabular ${
          highlight ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-display mb-3 text-2xl">{title}</h2>
      {children}
    </section>
  );
}
