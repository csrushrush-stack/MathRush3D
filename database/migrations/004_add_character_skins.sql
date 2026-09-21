INSERT INTO skins (id, name, color, price, sort_order, is_available) VALUES
  ('cyber', 'Neon Byte', '#22d3ee', 2600, 6, true),
  ('frost', 'Frost King', '#38bdf8', 3200, 7, true),
  ('toxic', 'Toxic Nova', '#84cc16', 3800, 8, true),
  ('royal', 'Royal Rush', '#f59e0b', 5000, 9, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  price = EXCLUDED.price,
  sort_order = EXCLUDED.sort_order,
  is_available = EXCLUDED.is_available;
