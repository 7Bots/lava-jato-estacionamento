import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VehicleType = "car" | "moto";
export type TicketStatus = "open" | "checked_out" | "confirmed" | "canceled";

export type Settings = {
  id: string;
  owner_id: string;
  price_car_cents: number;
  price_moto_cents: number;
  daily_car_cents: number;
  daily_moto_cents: number;
  block_minutes: number;
  grace_minutes: number;
  business_name: string | null;
  business_doc: string | null;
  business_phone: string | null;
};

export type Spot = {
  id: string;
  label: string;
  type: VehicleType;
  active: boolean;
};

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  cpf: string | null;
  email: string | null;
  notes: string | null;
  auto_created: boolean;
  created_at: string;
};

export type Vehicle = {
  id: string;
  customer_id: string | null;
  type: VehicleType;
  plate: string;
  model: string | null;
  color: string | null;
  brand: string | null;
};

export type Ticket = {
  id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  spot_id: string | null;
  vehicle_type: VehicleType;
  plate: string;
  price_block_cents: number;
  daily_cents: number;
  block_minutes: number;
  grace_minutes: number;
  checkin_at: string;
  checkout_at: string | null;
  status: TicketStatus;
  force_daily: boolean;
  manual_discount_cents: number;
  total_cents: number | null;
  payment_method: string | null;
  confirmed_at: string | null;
  customers?: { name: string; phone: string | null } | null;
  vehicles?: { model: string | null; color: string | null; brand: string | null } | null;
  spots?: { label: string; type: VehicleType } | null;
};

export type Expense = {
  id: string;
  description: string;
  category: string | null;
  amount_cents: number;
  date: string;
};

const TICKET_SELECT =
  "*, customers(name, phone), vehicles(model, color, brand), spots(label, type)";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as unknown as Settings | null;
    },
  });
}

export function useSpots() {
  return useQuery({
    queryKey: ["spots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("spots").select("*").order("label");
      if (error) throw error;
      return (data ?? []) as unknown as Spot[];
    },
  });
}

/** Tickets currently occupying a spot (open or checked out). */
export function useActiveTickets() {
  return useQuery({
    queryKey: ["tickets", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(TICKET_SELECT)
        .in("status", ["open", "checked_out"])
        .order("checkin_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Ticket[];
    },
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Customer[];
    },
  });
}

export function useVehicles() {
  return useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").order("plate");
      if (error) throw error;
      return (data ?? []) as unknown as Vehicle[];
    },
  });
}

export function useCustomerTickets(customerId: string | null) {
  return useQuery({
    queryKey: ["tickets", "customer", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(TICKET_SELECT)
        .eq("customer_id", customerId!)
        .order("checkin_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Ticket[];
    },
  });
}

/** Confirmed tickets within a period — the only source of revenue. */
export function useConfirmedTickets(fromISO: string, toISO: string) {
  return useQuery({
    queryKey: ["tickets", "confirmed", fromISO, toISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(TICKET_SELECT)
        .eq("status", "confirmed")
        .gte("confirmed_at", fromISO)
        .lte("confirmed_at", toISO)
        .order("confirmed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Ticket[];
    },
  });
}

export function useExpenses(
  fromDate?: string,
  toDate?: string,
  module: "parking" | "carwash" = "parking",
) {
  return useQuery({
    queryKey: ["expenses", module, fromDate ?? null, toDate ?? null],
    queryFn: async () => {
      let q = supabase
        .from("expenses")
        .select("*")
        .eq("module", module)
        .order("date", { ascending: false });
      if (fromDate) q = q.gte("date", fromDate);
      if (toDate) q = q.lte("date", toDate);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Expense[];
    },
  });
}

/** Keeps two devices in sync via Realtime. */
export function useRealtimeSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("parkpro-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
        qc.invalidateQueries({ queryKey: ["tickets"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "spots" }, () => {
        qc.invalidateQueries({ queryKey: ["spots"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

export function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

export function formatPlate(value: string) {
  const p = normalizePlate(value);
  return p.length > 3 ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

export function isValidPlate(value: string) {
  const p = normalizePlate(value);
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(p);
}

export const PAYMENT_METHODS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
] as const;

export const EXPENSE_CATEGORIES = [
  { value: "aluguel", label: "Aluguel" },
  { value: "salario", label: "Salários" },
  { value: "manutencao", label: "Manutenção" },
  { value: "impostos", label: "Impostos" },
  { value: "fornecedores", label: "Fornecedores" },
  { value: "outros", label: "Outros" },
] as const;

export function categoryLabel(value: string | null) {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? "Outros";
}

export function paymentLabel(value: string | null) {
  return PAYMENT_METHODS.find((p) => p.value === value)?.label ?? "—";
}
