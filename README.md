# SettleSync — AI-Powered Transaction Reconciliation

> A prototype built for the **Razorpay AI Buildathon (Track 04: AI Finance Controller)**.

SettleSync reconciles transactions across multiple financial sources. Upload CSVs from any number of sources — payment gateways, bank statements, internal systems — and it matches them using a three-tier approach:

1. **Deterministic Rules** — Instant matching for obvious cases (same txn_id, amount, date)
2. **ML Classifier** — Logistic regression trained on match history
3. **Grok AI** — Natural language analysis for ambiguous cases

Every match gets a confidence score and a reasoning explanation.

---

## How It Works

```
CSV Upload → Column Mapping → Reconciliation → Results
                    │
          ┌─────────┴─────────┐
          │                   │
     Pass 1: Rules      Pass 2: ML + AI
     (free, instant)    (learns over time)
          │                   │
          └─────────┬─────────┘
                    │
         Matched / Exceptions
         + Confidence Scores
         + Pattern Learning
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| AI | Grok (xAI) for ambiguous cases |
| ML | Custom logistic regression (no external ML libs) |
| Dev Server | Turbopack |

---

## Getting Started

```bash
# Install
npm install

# Set up database
# Paste the SQL from supabase/migration.sql into Supabase SQL Editor

# Configure
cp .env.example .env.local
# Fill in your Supabase URL, anon key, and Grok API key

# Generate test data
npm run generate-sample

# Run
npm run dev
# Open http://localhost:3000
```

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
GROK_API_KEY=your_grok_api_key
```

---

## Project Structure

```
settlesync/
├── src/
│   ├── app/
│   │   ├── page.js                    # Landing page
│   │   ├── upload/page.js             # CSV upload wizard
│   │   ├── reconcile/page.js          # Run reconciliation
│   │   ├── results/page.js            # View results
│   │   ├── dashboard/page.js          # Analytics
│   │   └── api/
│   │       ├── reconcile/route.js     # Matching engine (rules + ML + Grok)
│   │       ├── upload/route.js        # CSV upload handler
│   │       ├── results/route.js       # Fetch results
│   │       ├── export/route.js        # Audit log export
│   │       ├── batch/route.js         # Run tracking
│   │       ├── analytics/route.js     # Analytics data
│   │       └── progress/route.js      # SSE progress updates
│   └── lib/
│       ├── matching.js                # Shared matching rules
│       ├── ml.js                      # Logistic regression classifier
│       ├── confidence.js              # Confidence scoring
│       ├── patterns.js                # Fee/lag pattern learning
│       ├── grok.js                    # Grok AI integration
│       └── supabase.js                # Database client
├── scripts/
│   ├── generate_sample_data.js        # Test data generator
│   └── generate_large_dataset.js      # Large dataset generator
├── supabase/
│   └── migration.sql                  # Database schema
└── public/data/sample/                # Sample CSVs for testing
```

---

## ML Classifier

**Algorithm:** Logistic regression (implemented from scratch, no TensorFlow/PyTorch)

**Features used:**
- `amount_ratio` — min/max of two amounts
- `date_diff` — days between transactions
- `same_amount` — within ₹0.50 tolerance
- `same_date` — identical dates
- `fee_range` — in typical fee range (97–100%)

**How it learns:**
- After each reconciliation, match decisions are stored as training data
- The classifier retrains on this data
- After 5+ runs, it auto-resolves obvious pairs without calling Grok

**Inference thresholds:**
- ≥ 80% probability → auto-match
- ≤ 20% probability → auto-reject
- Between → sent to Grok for analysis

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload CSV data |
| `/api/reconcile` | POST | Run reconciliation |
| `/api/results` | GET | Fetch results |
| `/api/export` | GET | Export audit log (CSV/JSON) |
| `/api/batch` | POST/GET | Run tracking |
| `/api/progress` | GET | SSE progress stream |
| `/api/analytics` | GET | Analytics data |

---

## Sample Data

```bash
npm run generate-sample    # 284 records across 3 CSVs
npm run generate-large     # 487 records with edge cases
```

Files are saved to `public/data/sample/`.

---

## What's Next

- [ ] Frontend for manual review/override of exceptions
- [ ] Webhook support for real-time settlement notifications
- [ ] Multi-user authentication
- [ ] Batch queue for large-scale processing (100k+ records)
- [ ] Export to accounting software (Tally, Zoho)

---

## License

MIT
