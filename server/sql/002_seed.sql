insert into products (sku, name, description, unit) values
  ('SKU-001','Widget','Standard widget','each'),
  ('SKU-002','Gadget','Deluxe gadget','each')
on conflict (sku) do nothing;

insert into locations (name) values ('Main Warehouse')
on conflict (name) do nothing;

-- bins in Main Warehouse (assume it's id=1)
insert into bins (location_id, code) values
  (1,'A1'),(1,'A2')
on conflict do nothing;

-- give initial stock: 100 of SKU-001 in A1
insert into stock_levels(product_id, bin_id, qty)
select p.id, b.id, 100
from products p, bins b
where p.sku='SKU-001' and b.code='A1' and b.location_id=1
on conflict (product_id,bin_id) do update set qty=excluded.qty;

insert into stock_transactions(type, product_id, to_bin_id, qty, reference, performed_by)
select 'IN', p.id, b.id, 100, 'initial seed','seed'
from products p, bins b
where p.sku='SKU-001' and b.code='A1' and b.location_id=1;
