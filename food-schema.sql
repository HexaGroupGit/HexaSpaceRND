-- Food ordering (Seoul Bakery partner) — run in Supabase SQL Editor (safe to re-run).
-- Menu items are admin-editable (Admin → Food Orders); orders are created by the
-- member app, paid via Stripe (saved card or Checkout), and fulfilled by the
-- bakery: placed → accepted → delivered. Prices are GST-inclusive retail.

create table if not exists food_menu_items (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

alter table food_menu_items enable row level security;
drop policy if exists "anon all food_menu" on food_menu_items;
create policy "anon all food_menu" on food_menu_items for all to anon using (true) with check (true);
drop policy if exists "auth all food_menu" on food_menu_items;
create policy "auth all food_menu" on food_menu_items for all to authenticated using (true) with check (true);

create table if not exists food_orders (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

alter table food_orders enable row level security;
drop policy if exists "anon all food_orders" on food_orders;
create policy "anon all food_orders" on food_orders for all to anon using (true) with check (true);
drop policy if exists "auth all food_orders" on food_orders;
create policy "auth all food_orders" on food_orders for all to authenticated using (true) with check (true);

-- Starter menu (edit or remove in Admin → Food Orders; inserts skip existing ids).
insert into food_menu_items (id, data) values
  ('fm_sourdough',   '{"id":"fm_sourdough","name":"Sourdough loaf","description":"Slow-fermented country loaf, baked each morning","price":9.5,"category":"Breads","available":true,"sort":10}'),
  ('fm_milkbread',   '{"id":"fm_milkbread","name":"Korean milk bread","description":"Soft shokupan-style loaf","price":8,"category":"Breads","available":true,"sort":20}'),
  ('fm_croissant',   '{"id":"fm_croissant","name":"Butter croissant","description":"All-butter, laminated in house","price":5.5,"category":"Pastries","available":true,"sort":30}'),
  ('fm_painchoc',    '{"id":"fm_painchoc","name":"Pain au chocolat","description":"Dark chocolate batons","price":6,"category":"Pastries","available":true,"sort":40}'),
  ('fm_redbean',     '{"id":"fm_redbean","name":"Red bean bun","description":"Sweet brioche, house-made red bean paste","price":5.5,"category":"Pastries","available":true,"sort":50}'),
  ('fm_eggtart',     '{"id":"fm_eggtart","name":"Egg tart","description":"Flaky pastry, silky custard","price":5,"category":"Pastries","available":true,"sort":60}'),
  ('fm_latte',       '{"id":"fm_latte","name":"Latte","description":"Double shot, your choice of milk","price":5,"category":"Coffee","available":true,"sort":70}'),
  ('fm_longblack',   '{"id":"fm_longblack","name":"Long black","description":"Double shot over hot water","price":4.5,"category":"Coffee","available":true,"sort":80}'),
  ('fm_batchbrew',   '{"id":"fm_batchbrew","name":"Batch brew","description":"Rotating single origin","price":4.5,"category":"Coffee","available":true,"sort":90}'),
  ('fm_icedtea',     '{"id":"fm_icedtea","name":"Yuja iced tea","description":"Korean citron, lightly sweet","price":6,"category":"Drinks","available":true,"sort":100}'),
  ('fm_juice',       '{"id":"fm_juice","name":"Orange juice","description":"Cold-pressed daily","price":6.5,"category":"Drinks","available":true,"sort":110}'),
  ('fm_water',       '{"id":"fm_water","name":"Sparkling water","description":"500ml bottle","price":4,"category":"Drinks","available":true,"sort":120}')
on conflict (id) do nothing;
