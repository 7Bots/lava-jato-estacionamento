import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, Download } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { formatCents, formatDate, formatDuration } from "@/lib/format";
import { paymentLabel, useConfirmedTickets, useExpenses } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/faturamento")({
  head: () => ({
    meta: [
      { title: "Faturamento | Doca Lund Estacionamento" },
      {
        name: "description",
        content: "Painel de faturamento, despesas e indicadores do estacionamento.",
      },
      { property: "og:title", content: "Faturamento | Doca Lund" },
      { property: "og:description", content: "Indicadores e receita do estacionamento." },
    ],
  }),
  component: FaturamentoPage,
});

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const RANGES = [
  { key: "today", label: "Hoje", days: 0 },
  { key: "7d", label: "7 dias", days: 6 },
  { key: "30d", label: "30 dias", days: 29 },
  { key: "month", label: "Mês", days: -1 },
] as const;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function FaturamentoPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("7d");

  const { fromDate, toDate } = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const cfg = RANGES.find((r) => r.key === range)!;
    const start =
      cfg.days === -1
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : startOfDay(new Date(now.getTime() - cfg.days * 86400000));
    return { fromDate: start, toDate: end };
  }, [range]);

  const { data: tickets = [], isLoading } = useConfirmedTickets(
    fromDate.toISOString(),
    toDate.toISOString(),
  );
  const { data: expenses = [] } = useExpenses(dayKey(fromDate), dayKey(toDate));

  const revenue = tickets.reduce((a, t) => a + (t.total_cents ?? 0), 0);
  const expenseTotal = expenses.reduce((a, e) => a + e.amount_cents, 0);
  const profit = revenue - expenseTotal;
  const ticketAvg = tickets.length > 0 ? Math.round(revenue / tickets.length) : 0;
  const avgStay =
    tickets.length > 0
      ? tickets.reduce(
          (a, t) =>
            a +
            (new Date(t.checkout_at ?? t.checkin_at).getTime() - new Date(t.checkin_at).getTime()),
          0,
        ) / tickets.length
      : 0;

  const daily = useMemo(() => {
    const map = new Map<string, { receita: number; despesa: number }>();
    const cursor = new Date(fromDate);
    while (cursor <= toDate) {
      map.set(dayKey(cursor), { receita: 0, despesa: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    tickets.forEach((t) => {
      const k = dayKey(new Date(t.confirmed_at ?? t.checkin_at));
      const row = map.get(k);
      if (row) row.receita += (t.total_cents ?? 0) / 100;
    });
    expenses.forEach((e) => {
      const row = map.get(e.date);
      if (row) row.despesa += e.amount_cents / 100;
    });
    return Array.from(map.entries()).map(([k, v]) => ({
      dia: formatDate(`${k}T12:00:00`).slice(0, 5),
      ...v,
    }));
  }, [tickets, expenses, fromDate, toDate]);

  const byPayment = useMemo(() => {
    const map = new Map<string, number>();
    tickets.forEach((t) => {
      const k = paymentLabel(t.payment_method);
      map.set(k, (map.get(k) ?? 0) + (t.total_cents ?? 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: value / 100 }));
  }, [tickets]);

  const byHour = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hora: `${String(h).padStart(2, "0")}h`, entradas: 0 }));
    tickets.forEach((t) => {
      const h = new Date(t.checkin_at).getHours();
      buckets[h]!.entradas += 1;
    });
    return buckets;
  }, [tickets]);

  const byType = useMemo(() => {
    const car = tickets.filter((t) => t.vehicle_type === "car");
    const moto = tickets.filter((t) => t.vehicle_type === "moto");
    return [
      { name: "Carros", value: car.reduce((a, t) => a + (t.total_cents ?? 0), 0) / 100, count: car.length },
      { name: "Motos", value: moto.reduce((a, t) => a + (t.total_cents ?? 0), 0) / 100, count: moto.length },
    ];
  }, [tickets]);

  function exportCsv(): void {
    const rows = [
      ["Data", "Placa", "Tipo", "Vaga", "Entrada", "Saída", "Pagamento", "Total (R$)"],
      ...tickets.map((t) => [
        formatDate(t.confirmed_at ?? t.checkin_at),
        t.plate,
        t.vehicle_type === "car" ? "Carro" : "Moto",
        t.spots?.label ?? "",
        new Date(t.checkin_at).toLocaleString("pt-BR"),
        t.checkout_at ? new Date(t.checkout_at).toLocaleString("pt-BR") : "",
        paymentLabel(t.payment_method),
        ((t.total_cents ?? 0) / 100).toFixed(2).replace(".", ","),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `faturamento-${dayKey(fromDate)}-a-${dayKey(toDate)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Faturamento"
        subtitle="Receita, despesas e indicadores"
        action={
          <Button variant="outline" className="min-h-11" onClick={exportCsv} disabled={tickets.length === 0}>
            <Download className="size-4" /> Exportar CSV
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 px-4 py-4 md:px-8">
        {RANGES.map((r) => (
          <Button
            key={r.key}
            variant={range === r.key ? "default" : "outline"}
            className="min-h-11"
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-5 md:px-8">
        <Kpi label="Receita" value={formatCents(revenue)} tone="primary" />
        <Kpi label="Despesas" value={formatCents(expenseTotal)} />
        <Kpi
          label="Lucro líquido"
          value={formatCents(profit)}
          tone={profit >= 0 ? "success" : "danger"}
        />
        <Kpi label="Ticket médio" value={formatCents(ticketAvg)} />
        <Kpi label="Permanência média" value={avgStay ? formatDuration(avgStay) : "—"} />
      </div>

      {isLoading ? (
        <div className="space-y-3 p-4 md:p-8">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : tickets.length === 0 && expenses.length === 0 ? (
        <div className="p-4 md:p-8">
          <EmptyState
            icon={TrendingUp}
            title="Sem dados no período"
            description="Assim que houver comandas confirmadas, os indicadores aparecerão aqui."
          />
        </div>
      ) : (
        <div className="grid gap-4 p-4 md:grid-cols-2 md:p-8">
          <Panel title="Receita x Despesa por dia" className="md:col-span-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  formatter={(v: number) => formatCents(Math.round(v * 100))}
                  contentStyle={{ borderRadius: 12, background: "var(--card)", border: "1px solid var(--border)" }}
                />
                <Legend />
                <Line type="monotone" dataKey="receita" name="Receita" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="despesa" name="Despesa" stroke="var(--chart-5)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Entradas por hora">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="hora" stroke="var(--muted-foreground)" fontSize={10} interval={2} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, background: "var(--card)", border: "1px solid var(--border)" }} />
                <Bar dataKey="entradas" name="Entradas" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Receita por forma de pagamento">
            {byPayment.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem comandas confirmadas.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byPayment} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                    {byPayment.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip
                    formatter={(v: number) => formatCents(Math.round(v * 100))}
                    contentStyle={{ borderRadius: 12, background: "var(--card)", border: "1px solid var(--border)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title="Carros x Motos" className="md:col-span-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={12} width={70} />
                <Tooltip
                  formatter={(v: number) => formatCents(Math.round(v * 100))}
                  contentStyle={{ borderRadius: 12, background: "var(--card)", border: "1px solid var(--border)" }}
                />
                <Bar dataKey="value" name="Receita" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      )}
    </>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "primary" | "success" | "danger";
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-display text-2xl leading-none tabular md:text-3xl",
          tone === "primary" && "text-primary",
          tone === "success" && "text-chart-4",
          tone === "danger" && "text-destructive",
          !tone && "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <h2 className="text-display mb-3 text-2xl">{title}</h2>
      <div className="h-72">{children}</div>
    </section>
  );
}
