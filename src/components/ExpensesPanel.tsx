import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Receipt, Plus, Trash2, Pencil } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { EmptyState } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { centsToReaisInput, formatCents, formatDate, parseReaisToCents } from "@/lib/format";
import { EXPENSE_CATEGORIES, categoryLabel, useExpenses, type Expense } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export type ExpenseModule = "parking" | "carwash";

export function ExpensesPanel({ module }: { module: ExpenseModule }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const firstDay = useMemo(() => {
    const d = new Date();
    return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
  }, []);
  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(isoDate(new Date()));
  const [category, setCategory] = useState("todas");
  const { data: expenses = [], isLoading } = useExpenses(from, to, module);

  const [editing, setEditing] = useState<Expense | null>(null);
  const [open, setOpen] = useState(false);

  const filtered =
    category === "todas" ? expenses : expenses.filter((e) => (e.category ?? "outros") === category);
  const total = filtered.reduce((a, e) => a + e.amount_cents, 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((e) => {
      const key = e.category ?? "outros";
      map.set(key, (map.get(key) ?? 0) + e.amount_cents);
    });
    return Array.from(map.entries()).map(([key, value]) => ({
      name: categoryLabel(key),
      value: value / 100,
    }));
  }, [filtered]);

  async function remove(id: string): Promise<void> {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir a despesa.");
      return;
    }
    toast.success("Despesa excluída.");
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-3 py-4">
        <div>
          <Label htmlFor={`from-${module}`}>De</Label>
          <Input
            id={`from-${module}`}
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="min-h-11"
          />
        </div>
        <div>
          <Label htmlFor={`to-${module}`}>Até</Label>
          <Input
            id={`to-${module}`}
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="min-h-11"
          />
        </div>
        <div>
          <Label htmlFor={`cat-${module}`}>Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id={`cat-${module}`} className="min-h-11 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          className="min-h-11"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> Nova despesa
        </Button>
        <div className="ml-auto rounded-xl border border-border bg-card px-4 py-2">
          <p className="text-xs uppercase text-muted-foreground">Total do período</p>
          <p className="text-display text-3xl leading-none text-primary tabular">
            {formatCents(total)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 pb-8 md:grid-cols-[1fr_320px]">
        <section>
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nenhuma despesa no período"
              description="Registre aluguel, salários e manutenção para acompanhar o lucro líquido."
            />
          ) : (
            <ul className="space-y-2">
              {filtered.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.description}</p>
                    <p className="text-sm text-muted-foreground tabular">{formatDate(e.date)}</p>
                  </div>
                  <Badge variant="outline">{categoryLabel(e.category)}</Badge>
                  <span className="text-display text-2xl text-foreground tabular">
                    {formatCents(e.amount_cents)}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Editar despesa"
                    onClick={() => {
                      setEditing(e);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Excluir despesa"
                    onClick={() => remove(e.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {byCategory.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-display mb-2 text-2xl">Por categoria</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                  >
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatCents(Math.round(v * 100))}
                    contentStyle={{ borderRadius: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {byCategory.map((c, i) => (
                <li key={c.name} className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="flex-1">{c.name}</span>
                  <span className="tabular">{formatCents(Math.round(c.value * 100))}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <ExpenseDialog
        key={editing?.id ?? "new"}
        expense={editing}
        open={open}
        onOpenChange={setOpen}
        ownerId={user?.id ?? null}
        module={module}
      />
    </>
  );
}

function ExpenseDialog({
  expense,
  open,
  onOpenChange,
  ownerId,
  module,
}: {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ownerId: string | null;
  module: ExpenseModule;
}) {
  const qc = useQueryClient();
  const [description, setDescription] = useState(expense?.description ?? "");
  const [category, setCategory] = useState(expense?.category ?? "outros");
  const [amount, setAmount] = useState(centsToReaisInput(expense?.amount_cents ?? 0));
  const [date, setDate] = useState(expense?.date ?? isoDate(new Date()));
  const [saving, setSaving] = useState(false);

  async function save(): Promise<void> {
    if (!ownerId) return;
    if (!description.trim()) {
      toast.error("Informe a descrição da despesa.");
      return;
    }
    const cents = parseReaisToCents(amount);
    if (cents <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    setSaving(true);
    const payload = { description: description.trim(), category, amount_cents: cents, date };
    const { error } = expense
      ? await supabase.from("expenses").update(payload).eq("id", expense.id)
      : await supabase.from("expenses").insert({ ...payload, owner_id: ownerId, module });
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar a despesa.");
      return;
    }
    toast.success(expense ? "Despesa atualizada." : "Despesa registrada.");
    qc.invalidateQueries({ queryKey: ["expenses"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-display text-2xl">
            {expense ? "Editar despesa" : "Nova despesa"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="edesc">Descrição *</Label>
            <Input
              id="edesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-11"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="ecat">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="ecat" className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="eval">Valor (R$) *</Label>
              <Input
                id="eval"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="min-h-11"
              />
            </div>
            <div>
              <Label htmlFor="edate">Data *</Label>
              <Input
                id="edate"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="min-h-11"
              />
            </div>
          </div>
          <Button className="min-h-11" onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar despesa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
