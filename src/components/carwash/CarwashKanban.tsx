import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, Bike, Car, Clock, FileText, GripVertical, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNow } from "@/lib/tick";
import { formatCents, formatDuration, formatTime } from "@/lib/format";
import { formatPlate } from "@/lib/db";
import {
  CARWASH_STAGES,
  ticketServices,
  vehicleTypeLabel,
  type CarwashStage,
  type CarwashTicket,
} from "@/lib/carwash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CarwashComandaDialog, CarwashPaymentDialog } from "./CarwashComandaDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function TypeIcon({ type, className }: { type: string; className?: string }) {
  if (type === "moto") return <Bike className={className} />;
  if (type === "caminhonete" || type === "suv") return <Truck className={className} />;
  return <Car className={className} />;
}

const ORDINAL = ["1º", "2º", "3º", "4º", "5º", "6º", "7º", "8º", "9º", "10º"];

export function CarwashKanban({ tickets }: { tickets: CarwashTicket[] }) {
  const qc = useQueryClient();
  const [comanda, setComanda] = useState<CarwashTicket | null>(null);
  const [payment, setPayment] = useState<CarwashTicket | null>(null);
  const [revert, setRevert] = useState<{ ticket: CarwashTicket; to: CarwashStage } | null>(null);
  const [mobileStage, setMobileStage] = useState<CarwashStage>("novo");
  const [flash, setFlash] = useState<CarwashStage | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const byStage = useMemo(() => {
    const map: Record<CarwashStage, CarwashTicket[]> = {
      novo: [],
      andamento: [],
      concluido: [],
      canceled: [],
    };
    tickets.forEach((t) => map[t.stage]?.push(t));
    map.novo.sort((a, b) => a.arrived_at.localeCompare(b.arrived_at));
    map.andamento.sort((a, b) => (a.started_at ?? "").localeCompare(b.started_at ?? ""));
    map.concluido.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
    return map;
  }, [tickets]);

  async function apply(ticket: CarwashTicket, to: CarwashStage): Promise<void> {
    const patch: {
      stage: CarwashStage;
      started_at?: string | null;
      completed_at?: string | null;
    } = { stage: to };
    if (to === "andamento") {
      patch.started_at = ticket.started_at ?? new Date().toISOString();
      patch.completed_at = null;
    }
    if (to === "novo") {
      patch.started_at = null;
      patch.completed_at = null;
    }
    const { error } = await supabase.from("carwash_tickets").update(patch).eq("id", ticket.id);
    if (error) {
      toast.error("Não foi possível mover a ordem.");
      return;
    }
    setFlash(to);
    setTimeout(() => setFlash(null), 600);
    qc.invalidateQueries({ queryKey: ["carwash_tickets"] });
  }

  function move(ticket: CarwashTicket, to: CarwashStage) {
    if (to === ticket.stage) return;
    if (to === "concluido") {
      setPayment(ticket);
      return;
    }
    if (ticket.stage === "concluido") {
      setRevert({ ticket, to });
      return;
    }
    apply(ticket, to);
  }

  function handleDragEnd(e: DragEndEvent) {
    const to = e.over?.id as CarwashStage | undefined;
    const ticket = tickets.find((t) => t.id === e.active.id);
    if (!to || !ticket) return;
    move(ticket, to);
  }

  return (
    <>
      {/* Mobile stage selector */}
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1 md:hidden">
        {CARWASH_STAGES.map((s) => (
          <button
            key={s.value}
            onClick={() => setMobileStage(s.value)}
            className={cn(
              "min-h-11 rounded-lg px-2 text-xs font-semibold transition-colors",
              mobileStage === s.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground",
            )}
          >
            {s.label} ({byStage[s.value].length})
          </button>
        ))}
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible">
          {CARWASH_STAGES.map((s) => (
            <Column
              key={s.value}
              stage={s.value}
              label={s.label}
              tickets={byStage[s.value]}
              flash={flash === s.value}
              hiddenOnMobile={mobileStage !== s.value}
              onMove={move}
              onComanda={setComanda}
            />
          ))}
        </div>
      </DndContext>

      <CarwashComandaDialog
        ticket={comanda}
        open={!!comanda}
        onOpenChange={(v) => !v && setComanda(null)}
      />
      <CarwashPaymentDialog
        key={payment?.id ?? "none"}
        ticket={payment}
        open={!!payment}
        onOpenChange={(v) => !v && setPayment(null)}
      />

      <AlertDialog open={!!revert} onOpenChange={(v) => !v && setRevert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover do faturamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao sair de “Concluído”, o valor desta ordem deixa de contar no faturamento do
              lava-jato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (revert) apply(revert.ticket, revert.to);
                setRevert(null);
              }}
            >
              Mover mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Column({
  stage,
  label,
  tickets,
  flash,
  hiddenOnMobile,
  onMove,
  onComanda,
}: {
  stage: CarwashStage;
  label: string;
  tickets: CarwashTicket[];
  flash: boolean;
  hiddenOnMobile: boolean;
  onMove: (t: CarwashTicket, to: CarwashStage) => void;
  onComanda: (t: CarwashTicket) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <motion.section
      ref={setNodeRef}
      animate={flash ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "min-w-[85vw] snap-center rounded-xl border bg-muted/30 p-3 md:min-w-0",
        isOver ? "border-primary bg-primary/5" : "border-border",
        hiddenOnMobile && "hidden md:block",
      )}
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-display text-2xl">{label}</h2>
        <Badge variant="secondary" className="tabular">
          {tickets.length}
        </Badge>
      </header>
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {tickets.map((t, i) => (
            <KanbanCard
              key={t.id}
              ticket={t}
              index={i}
              onMove={onMove}
              onComanda={onComanda}
            />
          ))}
        </AnimatePresence>
        {tickets.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
            Nenhuma ordem aqui
          </p>
        )}
      </div>
    </motion.section>
  );
}

function KanbanCard({
  ticket,
  index,
  onMove,
  onComanda,
}: {
  ticket: CarwashTicket;
  index: number;
  onMove: (t: CarwashTicket, to: CarwashStage) => void;
  onComanda: (t: CarwashTicket) => void;
}) {
  const now = useNow();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
  });
  const services = ticketServices(ticket);
  const next: CarwashStage | null =
    ticket.stage === "novo" ? "andamento" : ticket.stage === "andamento" ? "concluido" : null;

  return (
    <motion.article
      ref={setNodeRef}
      layout
      layoutId={ticket.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
          : {}
      }
      className={cn(
        "relative rounded-xl border bg-card p-3 shadow-sm",
        ticket.stage === "novo" && index === 0 ? "border-primary" : "border-border",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...listeners}
          {...attributes}
          aria-label="Arrastar ordem"
          className="mt-1 cursor-grab touch-none text-muted-foreground"
        >
          <GripVertical className="size-4" />
        </button>
        <TypeIcon type={ticket.vehicle_type} className="mt-1 size-5 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-display text-2xl leading-none tracking-wide">
            {formatPlate(ticket.plate)}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {ticket.customers?.name ?? "Cliente"} · {vehicleTypeLabel(ticket.vehicle_type)}
          </p>
        </div>
        {ticket.stage === "novo" && (
          <Badge variant={index === 0 ? "default" : "secondary"}>
            {ORDINAL[index] ?? `${index + 1}º`}
          </Badge>
        )}
      </div>

      {ticket.stage === "novo" && index === 0 && (
        <p className="mt-2 text-xs font-semibold uppercase text-primary">Próximo da fila</p>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        {services.map((s) => (
          <span
            key={s.id}
            className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
          >
            {s.name_snapshot}
          </span>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground tabular">
        <Clock className="size-3.5" />
        {ticket.stage === "novo" && (
          <span>
            {formatTime(ticket.arrived_at)} · há{" "}
            {formatDuration(now - new Date(ticket.arrived_at).getTime())}
          </span>
        )}
        {ticket.stage === "andamento" && (
          <span>
            em atendimento há{" "}
            {formatDuration(now - new Date(ticket.started_at ?? ticket.arrived_at).getTime())}
          </span>
        )}
        {ticket.stage === "concluido" && (
          <span>concluído {ticket.completed_at ? formatTime(ticket.completed_at) : ""}</span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-display text-2xl text-primary tabular">
          {formatCents(ticket.total_cents || ticket.subtotal_cents)}
        </span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => onComanda(ticket)}>
            <FileText className="size-4" /> Comanda
          </Button>
          {next && (
            <Button size="sm" className="min-h-11" onClick={() => onMove(ticket, next)}>
              Avançar <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
