-- SettleSync — Final Database Schema
-- Run this once in Supabase SQL Editor → New query → Run

-- 1. Core tables
CREATE TABLE IF NOT EXISTS settlements (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  txn_id TEXT,
  amount NUMERIC,
  txn_date DATE,
  status TEXT DEFAULT 'unmatched',
  matched_with INT,
  match_reason TEXT,
  batch_id TEXT,
  confidence NUMERIC DEFAULT 0,
  run_id INT,
  column_mapping JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id SERIAL PRIMARY KEY,
  batch_id TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending',
  total_records INT DEFAULT 0,
  matched_count INT DEFAULT 0,
  exception_count INT DEFAULT 0,
  match_rate NUMERIC DEFAULT 0,
  config JSONB DEFAULT '{}',
  progress INT DEFAULT 0,
  phase TEXT DEFAULT 'waiting',
  message TEXT DEFAULT '',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_decisions (
  id SERIAL PRIMARY KEY,
  run_id INT REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  record_a_id INT,
  record_b_id INT,
  match_type TEXT,
  confidence NUMERIC,
  reasoning TEXT,
  feature_vector JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_patterns (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  pattern_type TEXT,
  pattern_value JSONB NOT NULL,
  sample_size INT DEFAULT 0,
  confidence NUMERIC DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_data (
  id SERIAL PRIMARY KEY,
  feature_vector JSONB NOT NULL,
  label BOOLEAN NOT NULL,
  confidence NUMERIC,
  source_pair TEXT,
  run_id INT REFERENCES reconciliation_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_settlements_batch ON settlements(batch_id);
CREATE INDEX IF NOT EXISTS idx_settlements_source ON settlements(source);
CREATE INDEX IF NOT EXISTS idx_runs_batch ON reconciliation_runs(batch_id);
CREATE INDEX IF NOT EXISTS idx_decisions_run ON match_decisions(run_id);
CREATE INDEX IF NOT EXISTS idx_patterns_source ON source_patterns(source);
CREATE INDEX IF NOT EXISTS idx_learning_pair ON learning_data(source_pair);

-- 3. Disable RLS (simpler for prototype)
ALTER TABLE settlements DISABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE match_decisions DISABLE ROW LEVEL SECURITY;
ALTER TABLE source_patterns DISABLE ROW LEVEL SECURITY;
ALTER TABLE learning_data DISABLE ROW LEVEL SECURITY;

-- 4. If tables already exist, add any missing columns
ALTER TABLE reconciliation_runs ADD COLUMN IF NOT EXISTS progress INT DEFAULT 0;
ALTER TABLE reconciliation_runs ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'waiting';
ALTER TABLE reconciliation_runs ADD COLUMN IF NOT EXISTS message TEXT DEFAULT '';

-- 5. Refresh Supabase schema cache
NOTIFY pgrst, 'reload schema';
