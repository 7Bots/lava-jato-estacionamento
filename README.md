# Lava Jato Estacionamento

PARK PRO — Optimized Lovable Prompt (v2)

HOW TO USE THIS FILE Paste Phase 0 + Phase 1 into Lovable as your first message (attach the visual identity image). Then paste each following phase one at a time, waiting for the build to finish between them. Building in phases dramatically reduces broken/hallucinated code compared to one giant prompt.

PHASE 0 — Global Rules (paste with EVERY phase, or pin it)

Language: The entire UI is in Brazilian Portuguese (pt-BR) — labels, buttons, toasts, empty states, validation, chart legends, PDF. Code, variable names and comments in English.

Locale: Currency R$ 1.234,56 (pt-BR Intl.NumberFormat). Dates DD/MM/AAAA. Time 24h. Timezone America/Sao_Paulo.

Branding: Use the attached visual identity image as the single source of truth for palette, logo and style. Extract primary/secondary/accent from it and define them as CSS variables / Tailwind theme tokens. Semantic colors are fixed: free = green, occupied = red, warning = amber.

Stack: React + TypeScript + Tailwind + shadcn/ui, Supabase (Auth + Postgres + Realtime), Recharts for charts, Framer Motion for animation, date-fns for dates.

Non-negotiables:

Mobile-first. Design at 375px width first, then scale up. Every table has a card fallback on mobile. Bottom nav on mobile, sidebar on desktop.
No dead UI. Never render a button or tab that doesn't work. If something isn't built yet, don't show it.
All money is stored in integer centavos in the database (3.00 → 300). Format only at display time. This avoids floating-point bugs.
All timestamps stored as timestamptz in UTC. Convert for display only.
Every list has a loading skeleton and an empty state (in Portuguese).
PHASE 1 — Foundation: Auth, Layout, Theme, Database
1.1 Database schema (create exactly this)
sql
-- Business settings (one row per owner)
settings (
  id uuid pk,
  owner_id uuid references auth.users,
  price_car_cents int default 300,        -- R$ 3,00 per block
  price_moto_cents int default 200,       -- R$ 2,00 per block
  daily_car_cents int default 3000,       -- R$ 30,00
  daily_moto_cents int default 2500,      -- R$ 25,00
  block_minutes int default 30,           -- billing block length
  grace_minutes int default 0,            -- free tolerance before 1st block
  business_name text,
  business_doc text,
  business_phone text,
  created_at timestamptz default now()
)

customers (
  id uuid pk, owner_id uuid,
  name text not null,
  phone text, cpf text, email text, notes text,
  created_at timestamptz default now()
)

vehicles (
  id uuid pk, owner_id uuid,
  customer_id uuid references customers on delete cascade,
  type text check (type in ('car','moto')) not null,
  plate text not null,                    -- store UPPERCASE, no spaces/dashes
  model text, color text, brand text,
  created_at timestamptz default now()
)

spots (
  id uuid pk, owner_id uuid,
  label text not null,                    -- 'C-01', 'M-03'
  type text check (type in ('car','moto')) not null,
  active boolean default true,
  created_at timestamptz default now()
)

tickets (                                  -- "comandas"
  id uuid pk, owner_id uuid,
  customer_id uuid references customers,
  vehicle_id uuid references vehicles,
  spot_id uuid references spots,
  vehicle_type text not null,             -- snapshot
  plate text not null,                    -- snapshot
  -- price snapshot at CHECK-IN (settings changes must not alter open tickets)
  price_block_cents int not null,
  daily_cents int not null,
  block_minutes int not null,
  grace_minutes int not null,
  checkin_at timestamptz not null default now(),
  checkout_at timestamptz,
  status text check (status in ('open','checked_out','confirmed','canceled')) default 'open',
  force_daily boolean default false,
  manual_discount_cents int default 0,
  total_cents int,                        -- frozen on checkout
  payment_method text,                    -- 'dinheiro'|'pix'|'debito'|'credito'
  confirmed_at timestamptz,
  created_at timestamptz default now()
)

expenses (
  id uuid pk, owner_id uuid,
  description text not null,
  category text,                          -- 'aluguel'|'salario'|'manutencao'|'outros'
  amount_cents int not null,
  date date not null,
  created_at timestamptz default now()
)

Constraints & indexes (important):

Partial unique index: a spot can have only one open ticket → create unique index on tickets(spot_id) where status in ('open','checked_out');
Index tickets(owner_id, status), tickets(owner_id, confirmed_at), vehicles(owner_id, plate), expenses(owner_id, date).
RLS enabled on every table, policy: owner_id = auth.uid() for select/insert/update/delete.
1.2 Auth

Supabase email+password cadastro and login, branded with the identity image. Protected routes; redirect unauthenticated users to /login. On first signup, auto-create a settings row with the defaults above.

1.3 Shell

Responsive navigation with these routes (build the shell + empty pages now): /patio (Registro), /vagas, /clientes, /faturamento, /despesas, /configuracoes. Desktop: collapsible sidebar with logo. Mobile: fixed bottom nav with icons + short labels. Animated active-tab indicator.

Acceptance: I can sign up, log in, see all 6 empty pages, and the theme matches my identity image on both mobile and desktop.

PHASE 2 — Settings + Spots (build this BEFORE check-in)
2.1 /configuracoes

Form to edit, in R$ (convert to centavos on save):

Valor por bloco — Carro (default R$ 3,00)
Valor por bloco — Moto (default R$ 2,00)
Valor da diária — Carro (default R$ 30,00)
Valor da diária — Moto (default R$ 25,00)
Duração do bloco em minutos (default 30) — this is the "tempo de atualização"
Tolerância grátis em minutos (default 0)
Dados do negócio (nome, CNPJ/CPF, telefone) — used in the PDF

Show a live preview: "Um carro que fica 2h15 pagará R$ X,XX" recalculated as the admin types.

2.2 Spot management
Inputs: Quantidade de vagas de carro and Quantidade de vagas de moto.
On save, auto-generate/adjust spots labeled C-01…C-NN and M-01…M-NN.
Admin can rename an individual spot, deactivate it (active=false, e.g. under maintenance), or add/remove.
Guard: never delete or deactivate a spot that has an open ticket — show a Portuguese error toast instead.

Acceptance: I set 20 car + 10 moto spots, they generate correctly, and I can change prices and see the preview update.

PHASE 3 — Billing Engine (pure function, build & test first)

Create src/lib/billing.ts with a pure, unit-testable function. All other screens must use it — never duplicate this math.

ts
type BillingInput = {
  checkinAt: Date;
  checkoutAt: Date;          // or "now" for live preview
  priceBlockCents: number;
  dailyCents: number;
  blockMinutes: number;
  graceMinutes: number;
  forceDaily: boolean;
  manualDiscountCents: number;
};

type BillingResult = {
  elapsedMs: number;
  blocksCharged: number;
  daysCharged: number;
  subtotalCents: number;
  totalCents: number;
  isDailyApplied: boolean;
  nextBlockAt: Date | null;   // when the price will increase next
  msToNextBlock: number | null;
};

Rules (implement exactly):

elapsed = checkoutAt - checkinAt. If elapsed <= graceMinutes → total = 0.
Split elapsed into full 24h periods (daysCharged = floor(elapsed / 24h)) and a remainder.
Charge daysCharged * dailyCents for the full days.
For the remainder: blocks = ceil(remainder / blockMinutes) (minimum 1 block if remainder > graceMinutes), cost = blocks * priceBlockCents.
Cap the remainder at the daily rate: remainderCost = min(blocks * priceBlockCents, dailyCents).
subtotal = daysCharged * dailyCents + remainderCost.
If forceDaily is true → subtotal = max(subtotal, (daysCharged + 1) * dailyCents).
total = max(0, subtotal - manualDiscountCents).
nextBlockAt = the timestamp of the next block boundary, null once the daily cap is reached (price is frozen — the UI should show "Diária aplicada").

Worked examples to verify (carro, R$3/30min, diária R$30):

Tempo	Blocos	Valor
12 min	1	R$ 3,00
30 min	1	R$ 3,00
31 min	2	R$ 6,00
1h30	3	R$ 9,00
5h00	10	R$ 30,00 (atinge a diária)
8h00	16 → capped	R$ 30,00
26h00	1 diária + 2 blocos	R$ 36,00

Moto uses R$2 / R$25 with identical logic.

Acceptance: the table above returns exactly these values.

PHASE 4 — /patio — Check-in & Live Vehicles

Two-column on desktop; on mobile, a "Novo check-in" primary button opens the form as a full-screen sheet, with the live list as the default view.

4.1 Check-in form

Smart flow — start with the plate.

Field 1: Placa (auto-uppercase, mask AAA-0A00 / AAA-0000). On blur, look up the plate.
Found: show a card "Cliente reconhecido: {nome}" and pre-fill everything. One tap to confirm.
Not found: expand fields for a new record.
Alternative: "Buscar cliente" combobox searching by name/phone/CPF for returning customers (a customer can have several vehicles → let me pick which one).
Cliente: nome*, telefone, CPF, e-mail, observações.
Veículo: tipo (Carro/Moto — segmented toggle with icons), placa, modelo, cor, marca.
Vaga: a visual mini-grid of only the available spots of the matching type. Selecting one highlights it. Show "Nenhuma vaga de moto disponível" if the type is full and block submit.
Submit "Fazer Check-in" → creates customer (if new) + vehicle (if new) + ticket status='open', snapshots the current prices into the ticket, occupies the spot. Confetti-free but a satisfying success animation + toast.

Validation (pt-BR messages): placa obrigatória e válida; nome obrigatório; vaga obrigatória; block duplicate open ticket for the same plate.

4.2 Live list — "Pátio atual"

A card per open ticket, sorted by check-in (oldest first). Each card shows:

Vehicle type icon + placa (large, bold) + customer name
Spot badge (C-07)
Live timer HH:MM:SS counting up, updating every second
Live total in R$, recalculated from billing.ts
A thin progress bar showing time until the next block, with the text "Próximo bloco em 07:42" — it fills up and the value ticks up with a brief scale/flash animation when a block closes
When the daily cap is hit, the bar is replaced by a badge "Diária aplicada"
Actions: Comanda and Check-out

Performance: use ONE global setInterval(1000) tick (a context or useSyncExternalStore) that all cards subscribe to. Do not create an interval per card.

Realtime: subscribe to Supabase Realtime on tickets and spots so two devices stay in sync.

Header strip with live counters: Vagas livres (carro / moto), Veículos no pátio, Receita confirmada hoje.

Acceptance: I check in a car, the card appears with a running timer, the value goes R$3 → R$6 at 30:01, and the chosen spot is now occupied.

PHASE 5 — Comanda (Ticket), Check-out & Confirm
5.1 "Abrir Comanda" modal

Opens for any open/checked-out ticket. Shows, laid out like a real receipt:

Business header (name/doc/phone from settings) + logo
Comanda nº (short id), Cliente, Telefone
Veículo: tipo, placa, modelo, cor
Vaga
Entrada: DD/MM/AAAA HH:mm — Saída: HH:mm (or "em aberto")
Tempo percorrido: Xh Ymin (live if still open)
Breakdown: N blocos × R$ X,XX, diárias, desconto
VALOR A PAGAR in large type
Controls: toggle "Aplicar diária", input "Desconto (R$)", select "Forma de pagamento" (Dinheiro / PIX / Débito / Crédito)

Actions:

Baixar comanda (PDF) — generate an A4 + 80mm-thermal-friendly PDF with the branding and all fields above. Filename comanda-{placa}-{DDMMAAAA-HHmm}.pdf. Available before and after confirmation.
Fazer Check-out → sets checkout_at, freezes total_cents, status checked_out. The timer stops. The spot is still occupied at this point.
Confirmar serviço → status confirmed, sets confirmed_at. Only now:
the amount enters Faturamento
the spot is released (turns green)
the card leaves "Pátio atual" and goes into the customer's history
Cancelar comanda (with confirmation dialog) → status canceled, releases the spot, does not count as revenue.

Hard rule: revenue = SUM(total_cents) WHERE status='confirmed'. Never count open, checked-out or canceled tickets.

Acceptance: I open a comanda, download the PDF, check out, confirm — and only then does the spot turn green and the revenue increase.

PHASE 6 — /vagas — Interactive Spot Grid

The showcase screen. Make it genuinely delightful.

Two labeled sections: Vagas de Carro and Vagas de Moto, each with a count 12/20 ocupadas.
Responsive grid: 2 cols @375px, 3 @640px, 4–6 @1024px+.
Free spot: green card, spot label, subtle "Livre" text, a soft breathing/glow animation on hover; clicking it opens the check-in form pre-filled with that spot.
Occupied spot: red card showing placa (prominent), customer first name, live timer, and current value. Clicking opens that ticket's comanda.
Long stay (over the daily cap): amber accent + "Diária" badge, so the operator spots it instantly.
Inactive spot: grey, "Manutenção", not clickable.
State transitions animate with Framer Motion layout (color morph + scale pulse when a spot frees up).
Filter chips: Todas / Livres / Ocupadas, and a search by placa that highlights the matching spot.

Acceptance: occupying a spot from /patio turns the matching card red here in real time, with the correct customer and a running timer.

PHASE 7 — /clientes
Searchable list (name / phone / plate / CPF) with card layout on mobile, table on desktop.
Cadastrar cliente manually, with the ability to attach one or more vehicles.
Customers are also created automatically at check-in — flag them as such.
Detail view: personal data, all their vehicles, and histórico de visitas (date, spot, elapsed time, amount, payment method, status) plus lifetime stats: total visits, total spent, average time, last visit.
"Novo check-in" shortcut from the customer page that pre-fills everything.
Edit and delete (block deletion when the customer has an open ticket).
PHASE 8 — /despesas
Create/edit/delete: descrição*, categoria (Aluguel, Salários, Manutenção, Impostos, Fornecedores, Outros), valor*, data*.
Period filter, category filter, total for the selected period.
A small pie/donut chart of expenses by category.
Expenses reduce net revenue in the dashboard.
PHASE 9 — /faturamento — Dashboard

Professional, animated, mobile-friendly analytics.

Period control (top): quick chips Hoje / 7 dias / Este mês / Mês passado / Personalizado + a date-range picker.

KPI cards (animated count-up, each with a % delta vs the previous equivalent period):

Faturamento Bruto
Despesas
Faturamento Líquido (Bruto − Despesas)
Veículos atendidos
Ticket médio
Tempo médio de permanência

Charts (Recharts, responsive, animated):

Faturamento vs Despesas — grouped bars over time (auto-granularity: hourly for a day, daily for a month, monthly for a year), with a Líquido line overlay.
Receita por tipo de veículo — Carro vs Moto (donut).
Ocupação por hora do dia — bar chart revealing peak hours.
Comparativo de períodos — pick Período A vs Período B (e.g. Junho vs Julho) and show them side by side: bars per metric + a table with Valor A, Valor B, Diferença (R$) and Variação (%), color-coded green/red.

Table: last confirmed transactions (data, placa, cliente, tempo, valor, pagamento) with CSV export for the selected period.

Acceptance: the numbers here reconcile exactly with the confirmed comandas, and switching the period updates every card and chart.

PHASE 10 — Polish
Page transitions, skeleton loaders, toasts (Portuguese), confirmation dialogs for destructive actions.
Empty states with an illustration + a clear CTA.
Dark mode derived from the identity palette.
PWA: installable, custom icon/splash from the identity image, works on a phone like a native app.
Keyboard shortcuts on desktop: N new check-in, / search.
Accessibility: focus rings, aria-labels, contrast ≥ 4.5:1, tap targets ≥ 44px.
Consistency audit: confirm every currency display uses the centavos→R$ formatter and every duration uses the same formatter.
Quick-fix prompts (keep these for later)
"O valor não está atualizando ao vivo nos cards. Garanta um único intervalo global de 1s compartilhado via contexto, e recalcule com billing.ts a cada tick."
"A vaga não está sendo liberada. Ela só deve ser liberada quando o ticket muda para status 'confirmed' ou 'canceled', nunca no check-out."
"Está entrando receita antes da confirmação. Faturamento deve somar apenas tickets com status 'confirmed'."
"Refaça a tela X pensando primeiro em 375px de largura: cards no lugar de tabela, navegação inferior, alvos de toque de 44px."


o nome e doca lund use a identidade visual desta logo para toda ferramenta

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cd6f6a8f-242f-410b-8cb2-96ede936bf8d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
