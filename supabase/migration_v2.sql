-- SettleSync v2 — Performance Indexes
-- Paste into Supabase SQL Editor → Run

CREATE INDEX IF NOT EXISTS idx_settlements_txn_id ON settlements(txn_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
