-- SettleSync Production Schema
-- Run this in Supabase SQL Editor

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
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_records INT DEFAULT 0,
  matched_count INT DEFAULT 0,
  exception_count INT DEFAULT 0,
  match_rate NUMERIC DEFAULT 0,
  config JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_decisions (
  id SERIAL PRIMARY KEY,
  run_id INT REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  record_a_id INT,
  record_b_id INT,
  match_type TEXT CHECK (match_type IN ('exact', 'fee-adjusted', 'date-shifted', 'grok-match', 'ml-match', 'exception')),
  confidence NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  reasoning TEXT,
  feature_vector JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_patterns (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  pattern_type TEXT CHECK (pattern_type IN ('fee', 'lag', 'amount_range')),
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

CREATE INDEX IF NOT EXISTS idx_settlements_batch ON settlements(batch_id);
CREATE INDEX IF NOT EXISTS idx_runs_batch ON reconciliation_runs(batch_id);
CREATE INDEX IF NOT EXISTS idx_decisions_run ON match_decisions(run_id);
CREATE INDEX IF NOT EXISTS idx_patterns_source ON source_patterns(source);
CREATE INDEX IF NOT EXISTS idx_learning_pair ON learning_data(source_pair);

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_data ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all' AND tablename = 'settlements') THEN
    CREATE POLICY allow_all ON settlements FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all' AND tablename = 'reconciliation_runs') THEN
    CREATE POLICY allow_all ON reconciliation_runs FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all' AND tablename = 'match_decisions') THEN
    CREATE POLICY allow_all ON match_decisions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all' AND tablename = 'source_patterns') THEN
    CREATE POLICY allow_all ON source_patterns FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all' AND tablename = 'learning_data') THEN
    CREATE POLICY allow_all ON learning_data FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
