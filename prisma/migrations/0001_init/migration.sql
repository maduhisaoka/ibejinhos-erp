CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  image TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  flavor_limit INTEGER NOT NULL DEFAULT 0,
  flavors JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number TEXT,
  customer_name TEXT NOT NULL,
  cpf TEXT,
  whatsapp TEXT NOT NULL,
  email TEXT,
  birthday_day INTEGER,
  birthday_month INTEGER,
  registration_street TEXT,
  registration_number TEXT,
  registration_complement TEXT,
  registration_neighborhood TEXT,
  registration_cep TEXT,
  delivery_same_as_registration BOOLEAN NOT NULL DEFAULT TRUE,
  recipient_name TEXT,
  address TEXT,
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  cep TEXT NOT NULL,
  items JSONB NOT NULL,
  subtotal DOUBLE PRECISION NOT NULL,
  delivery_distance_km DOUBLE PRECISION,
  delivery_fee DOUBLE PRECISION NOT NULL,
  discount DOUBLE PRECISION NOT NULL DEFAULT 0,
  loyalty_order_count INTEGER NOT NULL DEFAULT 1,
  total DOUBLE PRECISION NOT NULL,
  payment_method TEXT NOT NULL,
  receipt_path TEXT,
  status TEXT NOT NULL DEFAULT 'preparando',
  delivered BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT,
  whatsapp TEXT NOT NULL,
  birthday_day INTEGER,
  birthday_month INTEGER,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  cep TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_settings (
  id INTEGER PRIMARY KEY,
  minimum_order_value DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventory_ingredients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  current_quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
  minimum_quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
  purchase_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  supplier TEXT,
  last_purchase_date TEXT,
  expiry_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  sale_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  packaging_name TEXT,
  packaging_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  production_time TEXT,
  notes TEXT,
  finished_stock DOUBLE PRECISION NOT NULL DEFAULT 0,
  track_finished_stock BOOLEAN NOT NULL DEFAULT TRUE,
  desired_margin DOUBLE PRECISION NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS technical_cards (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL UNIQUE REFERENCES inventory_products(id) ON DELETE CASCADE,
  packaging_name TEXT,
  packaging_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  yield_quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
  yield_weight_grams DOUBLE PRECISION NOT NULL DEFAULT 0,
  unit_weight_grams DOUBLE PRECISION NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS technical_card_items (
  id SERIAL PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES technical_cards(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES inventory_ingredients(id) ON DELETE CASCADE,
  quantity DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  ingredient_id INTEGER REFERENCES inventory_ingredients(id) ON DELETE SET NULL,
  product_id INTEGER REFERENCES inventory_products(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  unit_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS productions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES inventory_products(id) ON DELETE CASCADE,
  quantity_produced DOUBLE PRECISION NOT NULL,
  production_date TEXT NOT NULL,
  expiry_date TEXT,
  notes TEXT,
  total_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_sales (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES inventory_products(id) ON DELETE CASCADE,
  quantity DOUBLE PRECISION NOT NULL,
  sale_date TEXT NOT NULL,
  total_value DOUBLE PRECISION NOT NULL,
  payment_method TEXT NOT NULL,
  notes TEXT,
  estimated_profit DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp_expenses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  due_date TEXT NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  recurring BOOLEAN NOT NULL DEFAULT FALSE,
  type TEXT NOT NULL DEFAULT 'fixa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp_receivables (
  id SERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  due_date TEXT NOT NULL,
  received BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_runs (
  id SERIAL PRIMARY KEY,
  courier_name TEXT NOT NULL,
  route_name TEXT NOT NULL,
  order_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_km DOUBLE PRECISION NOT NULL DEFAULT 0,
  estimated_minutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planejada',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_rules (
  id INTEGER PRIMARY KEY,
  points_per_real DOUBLE PRECISION NOT NULL DEFAULT 1,
  cashback_percent DOUBLE PRECISION NOT NULL DEFAULT 3,
  vip_threshold_points INTEGER NOT NULL DEFAULT 1200,
  inactive_days INTEGER NOT NULL DEFAULT 45
);

CREATE TABLE IF NOT EXISTS app_users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO store_settings (id, minimum_order_value)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO loyalty_rules (id, points_per_real, cashback_percent, vip_threshold_points, inactive_days)
VALUES (1, 1, 3, 1200, 45)
ON CONFLICT (id) DO NOTHING;
