-- ============================================================
-- Khatri Footwear Management System - Database Schema
-- Run this once in your Neon PostgreSQL SQL editor
-- ============================================================

-- Users (owner login)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'owner',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shop settings
CREATE TABLE IF NOT EXISTS shop_settings (
  id SERIAL PRIMARY KEY,
  shop_name VARCHAR(200) DEFAULT 'Khatri Footwear',
  owner_name VARCHAR(200) DEFAULT 'Bhavarlal Khatri',
  address TEXT,
  phone VARCHAR(20),
  gstin VARCHAR(20),
  invoice_prefix VARCHAR(10) DEFAULT 'KF',
  invoice_counter INTEGER DEFAULT 1,
  default_tax_pct NUMERIC(5,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default shop settings row
INSERT INTO shop_settings (shop_name, owner_name) VALUES ('Khatri Footwear', 'Bhavarlal Khatri')
ON CONFLICT DO NOTHING;

-- Products / Stock
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  brand VARCHAR(100) NOT NULL,
  article_number VARCHAR(100) NOT NULL,
  category VARCHAR(50) DEFAULT 'Men',
  size VARCHAR(20) NOT NULL,
  color VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  purchase_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  vendor VARCHAR(200),
  purchase_date DATE,
  low_stock_threshold INTEGER DEFAULT 3,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_article ON products(article_number);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Sales / Invoices
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(200) DEFAULT 'Walk-in Customer',
  customer_phone VARCHAR(20),
  subtotal_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_mode VARCHAR(30) DEFAULT 'Cash',
  sale_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);

-- Sale items (line items per invoice)
CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  brand VARCHAR(100),
  article_number VARCHAR(100),
  size VARCHAR(20),
  color VARCHAR(100),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

-- Vendor bills (upload history)
CREATE TABLE IF NOT EXISTS vendor_bills (
  id SERIAL PRIMARY KEY,
  vendor_name VARCHAR(200),
  cloudinary_url TEXT,
  cloudinary_public_id TEXT,
  original_filename VARCHAR(300),
  extracted_items JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock movements (audit log)
CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  movement_type VARCHAR(30) NOT NULL, -- 'in', 'out', 'adjustment'
  quantity INTEGER NOT NULL,
  reference_type VARCHAR(30), -- 'sale', 'manual', 'vendor_bill'
  reference_id INTEGER,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Run this in your Neon SQL editor to add report password support
-- (Only needed if you already ran schema.sql — new installs get this from schema.sql)
ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS report_password_hash TEXT;
