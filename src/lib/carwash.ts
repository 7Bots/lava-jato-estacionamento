import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CarwashStage = "novo" | "andamento" | "concluido" | "canceled";

export const CARWASH_STAGES = [
  { value: "novo", label: "Novo Cliente" },
  { value: "andamento", label: "Em Andamento" },
  { value: "concluido", label: "Concluído" },
] as const;

export const CARWASH_VEHICLE_TYPES = [
  { value: "car", label: "Carro" },
  { value: "moto", label: "Moto" },
  { value: "suv", label: "SUV" },
  { value: "caminhonete", label: "Caminhonete" },
] as const;

export function vehicleTypeLabel(value: string | null) {
  return CARWASH_VEHICLE_TYPES.find((t) => t.value === value)?.label ?? "Carro";
}

export type CarwashService = {
  id: string;
  owner_id: string;
  name: string;
  price_cents: number;
  active: boolean;
  sort_order: number;
};

export type CarwashTicketService = {
  id: string;
  ticket_id: string;
  service_id: string | null;
  name_snapshot: string;
  price_cents_snapshot: number;
};

export type CarwashTicket = {
  id: string;
  owner_id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  vehicle_type: string;
  plate: string;
  stage: CarwashStage;
  arrived_at: string;
  started_at: string | null;
  completed_at: string | null;
  subtotal_cents: number;
  manual_discount_cents: number;
  total_cents: number;
  payment_method: string | null;
  notes: string | null;
  customers?: { name: string; phone: string | null } | null;
  vehicles?: { model: string | null; color: string | null; brand: string | null } | null;
  carwash_ticket_services?: CarwashTicketService[];
};

const TICKET_SELECT =
  "*, customers(name, phone), vehicles(model, color, brand), carwash_ticket_services(*)";

export function useCarwashServices() {
  return useQuery({
    queryKey: ["carwash_services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carwash_services")
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as CarwashService[];
    },
  });
}

/** Ordens ativas no Kanban (novo, andamento e concluídas de hoje). */
export function useCarwashBoard() {
  return useQuery({
    queryKey: ["carwash_tickets", "board"],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("carwash_tickets")
        .select(TICKET_SELECT)
        .in("stage", ["novo", "andamento", "concluido"])
        .or(`stage.neq.concluido,completed_at.gte.${startOfDay.toISOString()}`)
        .order("arrived_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CarwashTicket[];
    },
  });
}

/** Ordens concluídas num período — única fonte de receita do lava-jato. */
export function useCarwashCompleted(fromISO: string, toISO: string) {
  return useQuery({
    queryKey: ["carwash_tickets", "completed", fromISO, toISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carwash_tickets")
        .select(TICKET_SELECT)
        .eq("stage", "concluido")
        .gte("completed_at", fromISO)
        .lte("completed_at", toISO)
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CarwashTicket[];
    },
  });
}

export function useCarwashRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("carwash-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "carwash_tickets" }, () => {
        qc.invalidateQueries({ queryKey: ["carwash_tickets"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

export function ticketServices(t: CarwashTicket) {
  return t.carwash_ticket_services ?? [];
}
