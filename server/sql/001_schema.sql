-- products / locations / bins
create table if not exists products (
  id serial primary key,
  sku text unique not null,
  name text not null,
  description text default '',
  unit text default 'each',
  created_at timestamptz default now()
);

create table if not exists locations (
  id serial primary key,
  name text unique not null
);

create table if not exists bins (
  id serial primary key,
  location_id int not null references locations(id) on delete cascade,
  code text not null,
  unique (location_id, code)
);

-- current snapshot
create table if not exists stock_levels (
  product_id int not null references products(id),
  bin_id int not null references bins(id),
  qty numeric(12,2) not null default 0,
  primary key (product_id, bin_id)
);

-- immutable movement history
create table if not exists stock_transactions (
  id bigserial primary key,
  occurred_at timestamptz default now(),
  type text not null check (type in ('IN','OUT','SHIP')),
  product_id int not null references products(id),
  from_bin_id int references bins(id),
  to_bin_id int references bins(id),
  qty numeric(12,2) not null check (qty > 0),
  reference text,
  performed_by text
);

-- helper view for UI table
create or replace view v_stock as
select
  sl.product_id,
  sl.bin_id,
  sl.qty,
  p.sku,
  p.name as product_name,
  b.code as bin_code
from stock_levels sl
join products p on p.id = sl.product_id
join bins b on b.id = sl.bin_id
order by p.sku, b.code;
