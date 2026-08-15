import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { centsToReaisInput, formatCents, parseReaisToCents } from "@/lib/format";
import { useCarwashServices, type CarwashService } from "@/lib/carwash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";


export function CarwashServicesPanel() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: services = [] } = useCarwashServices();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0,00");
  const [saving, setSaving] = useState(false);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["carwash_services"] });
  }

  async function add(): Promise<void> {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Informe o nome do serviço.");
      return;
    }
    const cents = parseReaisToCents(price);
    if (cents <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("carwash_services").insert({
      owner_id: user.id,
      name: name.trim(),
      price_cents: cents,
      sort_order: services.length,
    });
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar o serviço.");
      return;
    }
    toast.success("Serviço criado.");
    setName("");
    setPrice("0,00");
    refresh();
  }

  async function update(s: CarwashService, patch: Partial<CarwashService>): Promise<void> {
    const { error } = await supabase.from("carwash_services").update(patch).eq("id", s.id);
    if (error) {
      toast.error("Não foi possível atualizar o serviço.");
      return;
    }
    refresh();
  }

  async function move(index: number, dir: -1 | 1): Promise<void> {
    const target = services[index + dir];
    const current = services[index];
    if (!target || !current) return;
    await supabase
      .from("carwash_services")
      .update({ sort_order: index + dir })
      .eq("id", current.id);
    await supabase.from("carwash_services").update({ sort_order: index }).eq("id", target.id);
    refresh();
  }

  async function remove(s: CarwashService): Promise<void> {
    const { count } = await supabase
      .from("carwash_ticket_services")
      .select("id, carwash_tickets!inner(stage)", { count: "exact", head: true })
      .eq("service_id", s.id)
      .in("carwash_tickets.stage", ["novo", "andamento"]);
    if ((count ?? 0) > 0) {
      toast.error("Serviço está em ordens abertas. Desative em vez de excluir.");
      return;
    }
    const { error } = await supabase.from("carwash_services").delete().eq("id", s.id);
    if (error) {
      toast.error("Serviço já usado em ordens. Desative em vez de excluir.");
      return;
    }
    toast.success("Serviço excluído.");
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-display mb-3 text-2xl">Novo serviço</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
          <div>
            <Label htmlFor="svcname">Nome</Label>
            <Input
              id="svcname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-11"
              placeholder="Lavagem Simples"
            />
          </div>
          <div>
            <Label htmlFor="svcprice">Valor (R$)</Label>
            <Input
              id="svcprice"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="min-h-11"
            />
          </div>
          <Button className="min-h-11" onClick={add} disabled={saving}>
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>
      </div>

      <ul className="space-y-2">
        {services.map((s, i) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
          >
            <div className="flex flex-col">
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                aria-label="Subir"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                aria-label="Descer"
                disabled={i === services.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown className="size-3.5" />
              </Button>
            </div>
            <Input
              value={s.name}
              onChange={(e) => update(s, { name: e.target.value })}
              className="min-h-11 w-48 flex-1"
            />
            <Input
              defaultValue={centsToReaisInput(s.price_cents)}
              onBlur={(e) => update(s, { price_cents: parseReaisToCents(e.target.value) })}
              inputMode="decimal"
              className="min-h-11 w-28"
            />
            <span className="text-display text-xl tabular">{formatCents(s.price_cents)}</span>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={s.active} onCheckedChange={(v) => update(s, { active: v })} />
              {s.active ? "Ativo" : "Inativo"}
            </label>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Excluir serviço"
              onClick={() => remove(s)}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
