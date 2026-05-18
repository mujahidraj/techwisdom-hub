-- ====================================================
-- TechWisdom ERP V4 - Create Maintenance Hub Tables
-- ====================================================

-- Create the maintenance_contracts table
CREATE TABLE IF NOT EXISTS maintenance_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  project_id UUID REFERENCES active_projects(id) ON DELETE SET NULL,
  service_tier TEXT NOT NULL DEFAULT 'Standard',
  frequency TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' | 'quarterly' | 'yearly'
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  next_billing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'pending_payment' | 'overdue' | 'cancelled'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for project queries
CREATE INDEX IF NOT EXISTS idx_maintenance_contracts_project ON maintenance_contracts(project_id);

-- Enable RLS on maintenance_contracts
ALTER TABLE maintenance_contracts ENABLE ROW LEVEL SECURITY;

-- Policies for Authenticated Users
CREATE POLICY "Allow authenticated select maintenance_contracts"
  ON maintenance_contracts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert maintenance_contracts"
  ON maintenance_contracts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update maintenance_contracts"
  ON maintenance_contracts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated delete maintenance_contracts"
  ON maintenance_contracts FOR DELETE
  TO authenticated
  USING (true);

-- Create the maintenance_logs table
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES maintenance_contracts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for contract queries
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_contract ON maintenance_logs(contract_id);

-- Enable RLS on maintenance_logs
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;

-- Policies for Authenticated Users
CREATE POLICY "Allow authenticated select maintenance_logs"
  ON maintenance_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert maintenance_logs"
  ON maintenance_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete maintenance_logs"
  ON maintenance_logs FOR DELETE
  TO authenticated
  USING (true);
