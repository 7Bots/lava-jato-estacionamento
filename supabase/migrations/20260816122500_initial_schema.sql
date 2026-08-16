create extension if not exists pgcrypto;

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  price_car_cents integer not null default 300 check (price_car_cents >= 0),
  price_moto_cents integer not null default 200 check (price_moto_cents >= 0),
  daily_car_cents integer not null default 3000 check (daily_car_cents >= 0),
  daily_moto_cents integer not null default 2500 check (daily_moto_cents >= 0),
  block_minutes integer not null default 30 check (block_minutes > 0),
  grace_minutes integer not null default 0 check (grace_minutes >= 0),
  business_name text,
  business_doc text,
  business_phone text,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  cpf text,
  email text,
  notes text,
  auto_created boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  type text not null check (type in ('car', 'moto')),
  plate text not null,
  model text,
  color text,
  brand text,
  created_at timestamptz not null default now()
);

create table public.spots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  type text not null check (type in ('car', 'moto')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_id, label)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  spot_id uuid references public.spots(id) on delete set null,
  vehicle_type text not null check (vehicle_type in ('car', 'moto')),
  plate text not null,
  price_block_cents integer not null check (price_block_cents >= 0),
  daily_cents integer not null check (daily_cents >= 0),
  block_minutes integer not null check (block_minutes > 0),
  grace_minutes integer not null check (grace_minutes >= 0),
  checkin_at timestamptz not null default now(),
  checkout_at timestamptz,
  status text not null default 'open' check (status in ('open', 'checked_out', 'confirmed', 'canceled')),
  force_daily boolean not null default false,
  manual_discount_cents integer not null default 0 check (manual_discount_cents >= 0),
  total_cents integer check (total_cents >= 0),
  payment_method text check (payment_method is null or payment_method in ('dinheiro', 'pix', 'debito', 'credito')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  category text,
  amount_cents integer not null check (amount_cents >= 0),
  date date not null,
  module text not null default 'parking' check (module in ('parking', 'carwash')),
  created_at timestamptz not null default now()
);

create table public.carwash_services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.carwash_tickets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  vehicle_type text not null default 'car' check (vehicle_type in ('car', 'moto', 'suv', 'caminhonete')),
  plate text not null,
  stage text not null default 'novo' check (stage in ('novo', 'andamento', 'concluido', 'canceled')),
  arrived_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  manual_discount_cents integer not null default 0 check (manual_discount_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  payment_method text check (payment_method is null or payment_method in ('dinheiro', 'pix', 'debito', 'credito')),
  notes text,
  created_at timestamptz not null default now()
);

create table public.carwash_ticket_services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  ticket_id uuid not null references public.carwash_tickets(id) on delete cascade,
  service_id uuid references public.carwash_services(id) on delete set null,
  name_snapshot text not null,
  price_cents_snapshot integer not null check (price_cents_snapshot >= 0),
  created_at timestamptz not null default now()
);

create unique index tickets_one_active_per_spot
  on public.tickets (spot_id)
  where status in ('open', 'checked_out') and spot_id is not null;
create index tickets_owner_status_idx on public.tickets (owner_id, status);
create index tickets_owner_confirmed_at_idx on public.tickets (owner_id, confirmed_at);
create index vehicles_owner_plate_idx on public.vehicles (owner_id, plate);
create index expenses_owner_date_idx on public.expenses (owner_id, date);
create index carwash_tickets_owner_stage_idx on public.carwash_tickets (owner_id, stage);
create index carwash_tickets_owner_completed_at_idx on public.carwash_tickets (owner_id, completed_at);
create index carwash_ticket_services_ticket_idx on public.carwash_ticket_services (ticket_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'settings', 'customers', 'vehicles', 'spots', 'tickets', 'expenses',
    'carwash_services', 'carwash_tickets', 'carwash_ticket_services'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy "Owners can manage their own rows" on public.%I for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)',
      table_name
    );
  end loop;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.settings (owner_id, business_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'business_name', ''))
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter publication supabase_realtime add table public.tickets;
alter publication supabase_realtime add table public.spots;
alter publication supabase_realtime add table public.carwash_tickets;
