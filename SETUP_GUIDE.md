# SettleSync — Setup Guide

Clone → configure → run. Everything below is copy-pasteable.

---

## Prerequisites

| Tool | Install | Verify |
|------|---------|--------|
| **Node.js 20+** | https://nodejs.org → LTS | `node --version` → `v20.x.x` |
| **Git** | https://git-scm.com | `git --version` → `git version 2.x` |

---

## 1. Clone & Install

```bash
git clone https://github.com/Anakyn03/SettleSync.git
cd SettleSync
npm install
```

Expected: no errors, `node_modules/` folder created.

---

## 2. Database (Supabase)

1. Go to https://supabase.com → New Project → name it `settlesync`
2. Once ready, click **SQL Editor** (left sidebar) → **New query**
3. Paste this entire block and click **Run**:

```sql
-- SettleSync schema
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
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
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

CREATE INDEX IF NOT EXISTS idx_settlements_batch ON settlements(batch_id);
CREATE INDEX IF NOT EXISTS idx_settlements_source ON settlements(source);
CREATE INDEX IF NOT EXISTS idx_runs_batch ON reconciliation_runs(batch_id);
CREATE INDEX IF NOT EXISTS idx_decisions_run ON match_decisions(run_id);
CREATE INDEX IF NOT EXISTS idx_patterns_source ON source_patterns(source);
CREATE INDEX IF NOT EXISTS idx_learning_pair ON learning_data(source_pair);

ALTER TABLE settlements DISABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE match_decisions DISABLE ROW LEVEL SECURITY;
ALTER TABLE source_patterns DISABLE ROW LEVEL SECURITY;
ALTER TABLE learning_data DISABLE ROW LEVEL SECURITY;
```

4. Expected: `Success. No rows returned`
5. Copy your **Project URL** and **anon key** from Settings → API

---

## 3. Grok API Key (optional)

1. Go to https://console.x.ai → sign up → API Keys → Create
2. Name it `settlesync` → copy the key

If you skip this, the app still works — ambiguous cases get marked "needs review" instead of AI analysis.

---

## 4. Environment Variables

Create `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...your_key
GROK_API_KEY=xai-your_key_here
```

---

## 5. Generate Sample Data & Run

```bash
npm run generate-sample
npm run dev
```

Expected output:
```
▲ Next.js 15.x.x
- Local: http://localhost:3000
- Environments: .env.local
```

Open **http://localhost:3000** in your browser.

---

## 6. Test the Full Flow

1. **Upload**: Click "Load Sample Data" → follow the 3 steps → Upload
2. **Reconcile**: Click "Reconcile" → enter batch ID → Run
3. **Results**: Match rate and exceptions render on screen
4. **Export**: Click CSV or JSON to download audit log

Expected: match rate 85%+ for sample data, exceptions tab shows unmatched records.

---

## Troubleshooting

| What you see | What it means | What to do |
|---|---|---|
| `Supabase credentials not configured` | `.env.local` missing or wrong | Check URL and key match Supabase Settings → API |
| `Could not find the 'confidence' column` | SQL migration wasn't run | Re-run the SQL block from Step 2 |
| Upload shows "0 rows parsed" | CSV headers don't match | Ensure CSV has `txn_id`, `amount`, `date` columns (or map them in the UI) |
| Empty CSV uploaded → error | Expected behavior | The app rejects empty files — upload a CSV with data |
| Duplicate txn_id in same source → skipped | Expected behavior | Duplicate records within the same source are ignored to prevent false matches |
| Grok API timeout | xAI rate limit or network | Reconciliation still completes — ambiguous cases are marked "needs review" instead |
| `npm run dev` shows port 3000 in use | Another process is using the port | Run `npx kill-port 3000` then `npm run dev` again |
| Results page shows all "unmatched" | Status wasn't written to DB | Re-run reconciliation — this was a bug that's now fixed |
| `CREATE POLICY IF NOT EXISTS` SQL error | PostgreSQL doesn't support IF NOT EXISTS for policies | Use the SQL block above (it handles this correctly) |

---

## Project Structure

```
src/
  app/
    page.js              → Landing page
    upload/page.js       → CSV upload wizard
    reconcile/page.js    → Run reconciliation
    results/page.js      → View results + review exceptions
    dashboard/page.js    → Analytics overview
    api/
      upload/route.js    → Handles CSV uploads
      reconcile/route.js → Three-tier matching engine
      results/route.js   → Fetches results
      review/route.js    → Approve/reject exceptions
      export/route.js    → Download audit log
      analytics/route.js → Dashboard stats
      progress/route.js  → SSE progress stream
  lib/
    matching.js          → Core matching functions (tryMatch, daysBetween)
    confidence.js        → Confidence scoring + feature extraction
    ml.js                → Logistic regression classifier (zero dependencies)
    grok.js              → xAI Grok integration
    patterns.js          → Fee/lag pattern detection
    supabase.js          → Supabase client
scripts/
  generate_sample_data.js  → Creates sample CSVs
  generate_test_folders.js → Creates 10 test datasets
public/
  data/                  → Sample CSVs and 10 test folders
```
