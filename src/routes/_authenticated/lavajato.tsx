import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCarwashBoard, useCarwashRealtime } from "@/lib/carwash";
import { CarwashKanban } from "@/components/carwash/CarwashKanban";
import { CarwashOrderForm } from "@/components/carwash/CarwashOrderForm";
import { CarwashServicesPanel } from "@/components/carwash/CarwashServicesPanel";
import { CarwashDashboard } from "@/components/carwash/CarwashDashboard";
import { ExpensesPanel } from "@/components/ExpensesPanel";

export const Route = createFileRoute("/_authenticated/lavajato")({
  head: () => ({
    meta: [
      { title: "Lava-Jato | Doca Lund" },
      {
        name: "description",
        content: "Kanban de ordens, serviços, despesas e faturamento do lava-jato.",
      },
      { property: "og:title", content: "Lava-Jato | Doca Lund" },
      { property: "og:description", content: "Gestão completa do lava-jato em tempo real." },
    ],
  }),
  component: LavaJatoPage,
});

function LavaJatoPage() {
  useCarwashRealtime();
  const { data: tickets = [], isLoading } = useCarwashBoard();
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Lava-Jato"
        subtitle="Fila, atendimento e faturamento próprios"
        action={
          <Button className="min-h-11" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Nova ordem
          </Button>
        }
      />
      <div className="px-4 md:px-8">
        <Tabs defaultValue="kanban" className="pt-4">
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="servicos">Serviços</TabsTrigger>
            <TabsTrigger value="despesas">Despesas</TabsTrigger>
            <TabsTrigger value="dashboard">Faturamento</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="pt-4">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-64 rounded-xl" />
                ))}
              </div>
            ) : (
              <CarwashKanban tickets={tickets} />
            )}
          </TabsContent>

          <TabsContent value="servicos" className="pt-4">
            <CarwashServicesPanel />
          </TabsContent>

          <TabsContent value="despesas">
            <ExpensesPanel module="carwash" />
          </TabsContent>

          <TabsContent value="dashboard">
            <CarwashDashboard />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-display text-2xl">Nova ordem de serviço</DialogTitle>
          </DialogHeader>
          <CarwashOrderForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
