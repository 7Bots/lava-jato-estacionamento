import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { ExpensesPanel } from "@/components/ExpensesPanel";

export const Route = createFileRoute("/_authenticated/despesas")({
  head: () => ({
    meta: [
      { title: "Despesas | Doca Lund Estacionamento" },
      { name: "description", content: "Controle de despesas por categoria e período." },
      { property: "og:title", content: "Despesas | Doca Lund" },
      { property: "og:description", content: "Controle de despesas do estacionamento." },
    ],
  }),
  component: DespesasPage,
});

function DespesasPage() {
  return (
    <>
      <PageHeader title="Despesas" subtitle="Custos do estacionamento por categoria" />
      <div className="px-4 md:px-8">
        <ExpensesPanel module="parking" />
      </div>
    </>
  );
}
