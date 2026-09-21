-- ============================================================
-- MyShoppingList — schema (guide §4)
-- Every family table carries family_id for isolation (RLS in 0002).
-- ============================================================

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  family_id uuid references families on delete set null,
  display_name text,
  created_at timestamptz not null default now()
);

create table family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  token text not null unique,
  created_by uuid references profiles,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_at timestamptz
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (family_id, name)
);

-- Product catalog — built from scans
create table products (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  name text not null,
  barcode text,
  category_id uuid references categories on delete set null,
  default_unit text not null default 'unit' check (default_unit in ('unit','kg','liter')),
  created_at timestamptz not null default now()
);
create index on products (family_id, barcode);

create table shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  product_id uuid references products on delete set null,   -- null = free-text item
  raw_text text,                                            -- free text, if not linked to a product
  category_id uuid references categories on delete set null,
  quantity numeric not null default 1,
  unit text not null default 'unit' check (unit in ('unit','kg','liter')),
  status text not null default 'active' check (status in ('active','bought')),
  added_by uuid references profiles,
  bought_at timestamptz,
  bought_price numeric,          -- manual "bought" mark
  bought_store text,             -- manual "bought" mark
  bought_source text check (bought_source in ('manual','receipt')), -- who marked it (avoids double-counting in budget)
  created_at timestamptz not null default now()
);
create index on shopping_list_items (family_id, status);
create index on shopping_list_items (family_id, product_id);

create table receipts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  uploaded_by uuid references profiles,
  store_name text,
  store_branch text,
  purchase_date date,
  purchase_time text,
  receipt_number text,
  currency text not null default 'ILS',
  subtotal numeric,
  total numeric,
  status text not null default 'processing'
    check (status in ('processing','parsed','confirmed','failed')),
  raw_model_json jsonb,          -- raw model output
  image_paths text[],            -- storage paths, temporary; deleted on confirm
  error text,
  parsed_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on receipts (family_id, status);

create table receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts on delete cascade,
  family_id uuid not null references families on delete cascade,
  raw_name text not null,
  barcode text,
  item_type text not null default 'product'
    check (item_type in ('product','deposit','other')),
  quantity numeric not null,
  unit text not null default 'unit' check (unit in ('unit','kg','liter')),
  full_unit_price numeric,       -- as printed
  line_total numeric,            -- as printed
  discount numeric not null default 0,
  real_unit_price numeric,       -- computed = line_total / quantity
  matched_product_id uuid references products on delete set null,
  confidence text check (confidence in ('high','low')),
  created_at timestamptz not null default now()
);
create index on receipt_items (receipt_id);

-- Feeds the comparison views — written only on confirm
create table price_history (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  product_id uuid not null references products on delete cascade,
  receipt_item_id uuid references receipt_items on delete set null,
  real_unit_price numeric not null,
  full_unit_price numeric,
  unit text not null check (unit in ('unit','kg','liter')),
  store_name text,
  purchase_date date not null,
  created_at timestamptz not null default now()
);
create index on price_history (product_id, purchase_date);

-- Budget: a row with category_id = null is the overall monthly cap;
-- a row with category_id is that category's cap.
create table budgets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  category_id uuid references categories on delete cascade,
  amount numeric not null,
  created_at timestamptz not null default now(),
  unique (family_id, category_id)
);
-- Postgres UNIQUE treats NULLs as distinct, so enforce a single overall cap explicitly:
create unique index budgets_one_overall on budgets (family_id) where category_id is null;
