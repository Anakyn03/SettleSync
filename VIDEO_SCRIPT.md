# SettleSync — 5-Minute Video Recording Script
### Razorpay AI Buildathon — Track 04 (AI Finance Controller)

---

## Before You Record

- Open **https://settlesync.vercel.app** in Chrome (full screen, 1920×1080)
- Have a text editor open with the CSV examples below (to paste into Notepad/Excel if needed)
- Record using **OBS Studio** (free) or your screen recorder of choice
- Speak naturally — this is a script, not a speech. Pause between actions.
- **Total time: 5:00 minutes**

---

## SCENE 1 — The Problem (0:00 – 0:45)

### What to say:

> "Hi, I'm Anakyn, and this is SettleSync — an AI-powered transaction reconciliation engine.
>
> Every day, businesses like Razorpay process millions of payments. A single ₹5,000 payment shows up in three different places — Razorpay's dashboard, the bank statement, and the internal system — but each one looks different.
>
> Let me show you exactly what I mean."

### Screen action:

Open Notepad (or a text editor) and paste this CSV — show it on screen:

**Example: Same payment in 3 systems (show this on screen)**

```
── Razorpay Dashboard ──
txn_id: TXN001
amount: ₹5,000
date:   2026-08-21

── Bank Statement ──
txn_id: REF001
amount: ₹4,900
date:   2026-08-22

── Internal System ──
txn_id: ORD1234
amount: ₹5,000
date:   2026-08-21
```

> "Same payment, three different records. Different IDs, different amounts because the bank took a 2% fee, and different dates because the bank settles one day late. Now imagine doing this for 10,000 transactions a day. That's the problem SettleSync solves."

---

## SCENE 2 — The Solution: Upload (0:45 – 1:30)

### What to say:

> "SettleSync takes CSVs from any source and automatically matches transactions across systems. Let me walk you through it."

### Screen action:

1. Open **https://settlesync.vercel.app** in the browser
2. Click **"Get started"**
3. The upload page loads with sample scenarios

> "The upload page has 13 built-in test scenarios. Let me start with something simple — 'Fee Adjusted', where the bank charges a 2% processing fee on every transaction."

4. Click the **"Fee Adjusted"** button
5. The column mapping wizard appears (Step 1: Map)

> "SettleSync automatically detects which column is the Transaction ID, which is the Amount, and which is the Date. I can adjust these if needed."

6. Click **"Next →"**
7. The naming step appears (Step 2: Name)
8. Click **"Next →"**
9. The review step appears (Step 3: Review)

> "Three files — Razorpay, Bank, and Internal — each with 35 records. Let me upload them."

10. Click **"Upload 3 files"**
11. Upload completes (Step 4: Done) — green checkmarks appear

> "All three files uploaded successfully — 35 records each. Now let's reconcile."

---

## SCENE 3 — The Engine: Reconciliation (1:30 – 2:30)

### Screen action:

12. Click **"Reconcile →"**
13. Enter the batch ID (it's auto-filled) and click **"Run"**
14. The progress bar starts animating

### What to say:

> "Here's where the magic happens. SettleSync uses a three-tier matching engine:
>
> **Tier 1 — Deterministic Rules:** It groups records by transaction ID and tries exact matches first, then fee-adjusted matches, then date-shifted matches. This handles about 85% of records.
>
> **Tier 2 — Machine Learning:** For records that couldn't be matched by rules, a logistic regression classifier I built from scratch — zero external ML libraries — predicts whether two records are the same transaction. It extracts 5 features: amount ratio, date difference, whether amounts are exactly the same, whether dates match, and whether the fee is in the typical 1-3% range.
>
> **Tier 3 — Grok AI by xAI:** Only the truly ambiguous cases — where the ML classifier is uncertain — get sent to Grok. This keeps API costs low while getting expert AI judgment on edge cases."

15. Progress bar reaches 100%, reconciliation completes

> "Done. Let's see the results."

---

## SCENE 4 — Results & Confidence (2:30 – 3:15)

### Screen action:

16. Click to view results (or navigate to Results page with the batch ID)
17. The results table loads

### What to say:

> "The results page shows every matched and unmatched record. Each match gets a confidence score from 0 to 100 percent.
>
> Look at this — most records matched with high confidence. The fee-adjusted matches show exactly why they matched: for example, this Razorpay record of ₹18,954 matched the bank record of ₹18,575 because the difference is exactly 2%, the standard bank processing fee."

18. Point to a specific row in the table

> "Every exception — every record that couldn't be matched automatically — gets a confidence badge: high, medium, or low. And you can approve or reject each one with a single click."

19. Click **Exceptions** tab
20. Click **"Approve"** on one exception

> "Just approved that one — it's now marked as matched. This is the human-in-the-loop review that finance teams need."

21. Click **CSV** export button (or point to it)

> "And the entire audit trail — every match, every decision, every confidence score — can be exported as CSV or JSON for compliance."

---

## SCENE 5 — Dashboard & Pattern Learning (3:15 – 3:45)

### Screen action:

22. Navigate to **Dashboard**

### What to say:

> "The dashboard shows run history and — this is the part I'm most proud of — learned patterns.
>
> SettleSync discovers patterns from your data over multiple runs. For example, if the bank consistently charges a 2% fee across 15+ transactions, SettleSync learns that pattern and uses it to boost confidence on future fee-adjusted matches by 10 points.
>
> It also learns settlement lag — how many days the bank typically takes to credit. These patterns make the system smarter with every reconciliation run."

23. Point to the patterns section on the dashboard

> "This is a prototype of a system that gets better the more you use it."

---

## SCENE 6 — Failure Handling (3:45 – 4:30)

### What to say:

> "Now let me show you what happens when things go wrong — because in real life, CSVs are messy."

### Screen action:

24. Navigate to **Upload** page
25. Scroll to **"Failure demos (graceful degradation)"** section
26. Click **"Malformed CSV"**

> "This scenario has 7 rows, but most are broken — missing amounts, invalid dates, text where numbers should be. Let me upload it."

27. Click through the upload steps
28. Upload completes

> "The system didn't crash. It validated each row individually — kept the good ones, reported the bad ones with specific error messages: 'Row 3: missing txn_id', 'Row 4: amount is not a number'. You see exactly what broke and what was saved."

### Show this CSV on screen (optional — open in Notepad):

**Malformed CSV example:**
```
txn_id,amount,date
INV001,5000,2026-08-20
INV002,,2026-08-21        ← missing amount
,3000,2026-08-22          ← missing txn_id
INV003,abc,2026-08-23    ← amount is text
INV004,4000,              ← missing date
"unclosed quote,5000,2026-08-24  ← bad CSV formatting
INV005,6000,not-a-date   ← invalid date format
```

> "Out of 7 rows, only 1 was valid — INV001. The rest were rejected with clear reasons. That's graceful degradation."

29. Go back to Upload page
30. Click **"Empty Files"**

> "What about completely empty files? Headers only, no data at all?"

31. Upload completes

> "Clean error message: 'No valid rows after validation.' No crash, no blank screen — just a clear message telling the user what happened."

---

## SCENE 7 — Tech & Wrap-Up (4:30 – 5:00)

### What to say:

> "Quick tech overview: SettleSync is built with Next.js 15 on the frontend, Supabase for the database, and Grok by xAI for the AI tier. The ML classifier is logistic regression — implemented from scratch in JavaScript with zero dependencies. No TensorFlow, no PyTorch. Just math.
>
> The system is deployed live on Vercel. The entire codebase is on GitHub. It handles 13 test scenarios — 8 normal and 5 failure cases. Every match gets a confidence score. Every decision is auditable. The system learns fee patterns and settlement lags over time, and the ML improves with each run.
>
> SettleSync isn't just a hackathon prototype — it's a foundation for a production-grade reconciliation engine that could handle real Razorpay workloads.
>
> Thank you."

### Screen action:

32. Navigate back to the landing page **https://settlesync.vercel.app**
33. Let the landing page sit for 2 seconds
34. Stop recording

---

## Appendix A: Example CSVs You Can Show on Screen

### Working Example — Fee Adjusted (show first 5 rows of each)

**razorpay.csv:**
```
txn_id,amount,date
INV100866,18954.09,2026-08-26
INV261233,2405.24,2026-08-27
INV945509,46864.50,2026-08-19
INV472569,42757.42,2026-08-27
INV577333,33307.00,2026-08-16
```

**bank.csv (note: amounts are ~2% lower):**
```
txn_id,amount,date
INV100866,18575.01,2026-08-19
INV261233,2357.14,2026-08-25
INV945509,45927.21,2026-08-15
INV472569,41902.27,2026-08-26
INV577333,32640.86,2026-08-19
```

> "See how the bank amounts are exactly 2% less? INV100866 is ₹18,954 on Razorpay but ₹18,575 on the bank statement — a 2% fee. SettleSync automatically detects this pattern."

---

### Working Example — Perfect Match (show first 3 rows)

**razorpay.csv:**
```
txn_id,amount,date
TXN100295,19093.84,2026-08-18
TXN572128,17910.97,2026-08-23
TXN761881,18507.12,2026-08-14
```

**bank.csv:**
```
txn_id,amount,date
TXN100295,19093.84,2026-08-18
TXN572128,17910.97,2026-08-23
TXN761881,18507.12,2026-08-14
```

> "Same IDs, same amounts, same dates — 100% exact match. Tier 1 handles this instantly."

---

### Malformed Example (show on screen when demonstrating failure)

```
txn_id,amount,date
INV001,5000,2026-08-20
INV002,,2026-08-21
,3000,2026-08-22
INV003,abc,2026-08-23
INV004,4000,
"unclosed quote,5000,2026-08-24
INV005,6000,not-a-date
```

> "Seven rows, but only one is valid. The rest have missing amounts, missing IDs, text where numbers should be, or invalid dates. Watch what SettleSync does."

---

## Appendix B: Quick Reference — What to Click

| Time | Action | What You See |
|------|--------|-------------|
| 0:00 | Camera on you | "Hi, I'm Anakyn..." |
| 0:10 | Show CSV example in Notepad | 3 systems, same payment |
| 0:45 | Open settlesync.vercel.app | Landing page |
| 0:50 | Click "Get started" | Upload page |
| 0:55 | Click "Fee Adjusted" | Column mapping wizard |
| 1:05 | Click "Next →" | Source naming |
| 1:10 | Click "Next →" | Review step |
| 1:15 | Click "Upload 3 files" | Upload progress |
| 1:25 | Click "Reconcile →" | Batch ID input |
| 1:30 | Click "Run" | Progress bar animates |
| 2:00 | Results load | Match rate, stats, table |
| 2:15 | Click "Exceptions" tab | Exception list with badges |
| 2:25 | Click "Approve" on one | Status changes to matched |
| 2:30 | Click "CSV" export | Download starts |
| 2:45 | Navigate to Dashboard | Run history, patterns |
| 3:00 | Navigate back to Upload | Upload page |
| 3:05 | Click "Malformed CSV" | Column mapping |
| 3:15 | Click through steps | Upload broken CSV |
| 3:25 | Show upload results | Error messages per row |
| 3:35 | Click "Empty Files" | Upload empty CSV |
| 3:45 | Show error message | "No valid rows" |
| 4:00 | Navigate to Landing | Landing page |
| 4:15 | Say wrap-up lines | Tech summary |
| 5:00 | Stop recording | Done |

---

## Appendix C: If Something Goes Wrong During Recording

| Problem | Fix |
|---------|-----|
| Live site is slow (cold start) | Say "First load takes a moment — subsequent visits are instant" |
| Upload fails | Try a different scenario — click "Perfect Match" instead |
| Results page is blank | Make sure you clicked "Reconcile" first, then check Results with the batch ID |
| Progress bar doesn't animate | This is normal on slow connections — say "The engine is processing in the background" |
| Grok API fails | The system falls back to ML-only matching — say "The AI tier is optional — ML handles most cases" |
| You go over 5 minutes | Cut Scene 5 (Dashboard) — it's the least essential part |

---

*Generated for Razorpay AI Buildathon — Track 04*
