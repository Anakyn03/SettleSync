# 🚀 SettleSync — Complete Beginner Setup Guide

> This guide assumes you know NOTHING about web development. I will explain every single click and command.

---

## 📋 What You Need (Install These First)

### 1. Install Node.js (The Engine That Runs Our App)

**What is Node.js?** It's a program that lets your computer run JavaScript code. Think of it like Java Runtime — you need it to run Java programs. Same idea.

**How to install:**
1. Go to **https://nodejs.org**
2. Click the big green button that says **"LTS"** (Long Term Support — the stable version)
3. Run the downloaded file (`.msi` on Windows, `.pkg` on Mac)
4. Click "Next" through everything, accept defaults
5. **Restart your computer** after installation

**How to verify it worked:**
- Open "Command Prompt" (Windows) or "Terminal" (Mac)
- Type: `node --version`
- You should see something like `v20.x.x` — that means it worked!

---

### 2. Install Git (For Version Control & GitHub)

**What is Git?** It tracks changes to your code so you can share it on GitHub.

**How to install:**
1. Go to **https://git-scm.com**
2. Download for your operating system
3. Run the installer, click "Next" through everything, accept all defaults

**How to verify:**
- Open Command Prompt/Terminal
- Type: `git --version`
- You should see `git version 2.xx.x`

---

### 3. Create a GitHub Account (If You Don't Have One)

1. Go to **https://github.com**
2. Click "Sign up"
3. Follow the steps to create a free account

---

### 4. Create a Supabase Account (Free Database)

**What is Supabase?** It's like Google Sheets but more powerful — a place to store data in the cloud. We'll use it to store transaction records.

**How to set up:**
1. Go to **https://supabase.com**
2. Click "Start your project" → Sign up with GitHub (easiest)
3. Once logged in, click **"New Project"**
4. Fill in:
   - **Organization**: Create one (e.g., "My Hackathon")
   - **Project Name**: `settlesync`
   - **Database Password**: Make one up (write it down!)
   - **Region**: Choose closest to you
5. Click **"Create new project"** — wait 1-2 minutes for it to set up

**Get your API keys:**
1. Once project is ready, click the **gear icon** (⚙️) in the left sidebar → **"API"**
2. You'll see two values you need:
   - **Project URL**: looks like `https://xxxxxxxx.supabase.co`
   - **anon/public key**: a long string starting with `eyJ...`
3. **Copy both** — you'll need them soon

---

### 5. Set Up the Database Table

1. In Supabase, click the **"SQL Editor"** icon in the left sidebar (looks like a document)
2. Click **"New query"**
3. Copy and paste this ENTIRE block of code:

```sql
-- Create the settlements table
create table settlements (
  id serial primary key,
  source text not null,
  txn_id text,
  amount numeric,
  txn_date date,
  status text default 'unmatched',
  matched_with int,
  match_reason text,
  batch_id text,
  created_at timestamp default now()
);

-- Create an index for faster queries by batch
create index idx_settlements_batch on settlements(batch_id);

-- Allow the app to read/write (disable RLS for hackathon simplicity)
alter table settlements enable row level security;

create policy "Allow all access" on settlements
  for all
  using (true)
  with check (true);
```

4. Click the **"Run"** button (bottom right)
5. You should see "Success" — the table is created!

---

### 6. Get a Grok API Key (For AI Analysis)

**What is Grok?** It's an AI (like ChatGPT) from xAI. We'll only use it for the hard-to-match transactions.

1. Go to **https://console.x.ai**
2. Sign up / Log in
3. Go to **"API Keys"** in the menu
4. Click **"Create API Key"**
5. Name it `settlesync`
6. **Copy the key** immediately (you won't see it again!)

> **Note:** If xAI doesn't work for you, the app still works — it'll just mark ambiguous cases as "needs manual check" instead of using AI.

---

## 🛠️ Setting Up the Project on Your Computer

### Step 1: Open the Project Folder

1. Find the `settlesync` folder on your computer (where all the code is)
2. **Right-click** inside the folder → **"Open in Terminal"** or **"Open in Command Prompt"**
   - On Windows: Hold Shift, right-click, select "Open PowerShell window here" or "Open in Terminal"
   - On Mac: Open Terminal, type `cd ` (with a space), then drag the folder into the Terminal window

### Step 2: Install Dependencies

Type this command and press Enter:

```bash
npm install
```

Wait for it to finish (might take 1-2 minutes). You'll see a bunch of text scroll by — that's normal.

### Step 3: Configure Environment Variables

The `.env.local` file is where you put your secret keys. Let's fill it in:

1. Open the `.env.local` file in any text editor (Notepad, VS Code, etc.)
2. Replace the empty values with your actual keys:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your_actual_key_here
GROK_API_KEY=xai-your_actual_grok_key_here
```

3. **Save the file**

> ⚠️ **IMPORTANT:** Never share these keys publicly or commit them to GitHub. The `.gitignore` file already excludes `.env.local` from being uploaded.

### Step 4: Generate Test Data

Type this command:

```bash
npm run generate-data
```

This creates 3 CSV files with fake transaction data in `public/data/`.

### Step 5: Start the App

Type this command:

```bash
npm run dev
```

You'll see output like:
```
▲ Next.js 15.x.x
- Local: http://localhost:3000
```

**Open your browser** and go to: **http://localhost:3000**

🎉 **Congratulations! The app is running on your computer!**

---

## 🧪 Testing the App (Step by Step)

### Test 1: Upload CSV Files

1. On the home page, you'll see three upload cards: Razorpay, Bank, Internal
2. For **Razorpay Settlement**: Click "Choose File" → navigate to `public/data/` → select `razorpay_settlement.csv`
3. You should see a preview of the data and a row count
4. Click **"Upload Razorpay Settlement"**
5. You should see "✅ X records uploaded successfully"
6. **Repeat** for Bank Statement (`bank_statement.csv`) and Internal Orders (`internal_orders.csv`)
7. Once all 3 are uploaded, you'll see "🎉 All files uploaded!" with a button to proceed

### Test 2: Run Reconciliation

1. Click **"Run Reconciliation →"** (or go to http://localhost:3000/reconcile)
2. The batch ID should already be filled in
3. Click **"Run Reconciliation"**
4. Watch the progress — it should complete in a few seconds
5. You'll see results: match rate, matched count, exceptions count

### Test 3: View Results

1. Click **"View Detailed Results →"**
2. You'll see a big match rate number (should be 80%+)
3. Browse the tabs: All Records, Exceptions, Matched
4. Click **"Export CSV"** to download the audit log

### Test 4: Error Handling

Try these to make sure errors are handled properly:
1. Upload an empty CSV file → should show "CSV file is empty"
2. Upload a file that's not CSV → should show "Please upload a CSV file"
3. Try to reconcile with a fake batch ID → should show "No records found"
4. Upload the same CSV twice for the same source → should skip duplicates

---

## 📤 Pushing to GitHub

### Step 1: Create a New Repository on GitHub

1. Go to **https://github.com**
2. Click the **"+"** icon (top right) → **"New repository"**
3. Fill in:
   - **Repository name**: `settlesync`
   - **Description**: "AI-powered transaction reconciliation for hackathon"
   - **Public** (so judges can see it)
4. **DON'T** check "Add a README" (we already have files)
5. Click **"Create repository"**

### Step 2: Connect Your Local Folder to GitHub

Go back to your Terminal (make sure you're in the settlesync folder):

```bash
git init
git add .
git commit -m "Initial SettleSync - AI transaction reconciliation"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/settlesync.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

> If asked for credentials, use your GitHub username and a **Personal Access Token** (not your password). To create one: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token → Check `repo` scope → Generate.

---

## 🌐 Deploying to Vercel (Free Hosting)

### Step 1: Create a Vercel Account

1. Go to **https://vercel.com**
2. Click "Sign Up" → **Continue with GitHub** (easiest)
3. Authorize Vercel to access your GitHub

### Step 2: Import Your Project

1. On the Vercel dashboard, click **"Add New..."** → **"Project"**
2. Find `settlesync` in the list → Click **"Import"**
3. You'll see a configuration page — keep defaults
4. Before clicking Deploy, expand **"Environment Variables"**
5. Add these three:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
   - `GROK_API_KEY` = your Grok API key
6. Click **"Deploy"**
7. Wait 1-2 minutes for the build to finish

### Step 3: Your App is Live!

After deployment, Vercel gives you a URL like `https://settlesync.vercel.app`

**Share this URL with anyone** — they can use the app without installing anything!

---

## 🔄 Updating the Deployed App

Whenever you make changes:

```bash
git add .
git commit -m "Description of what you changed"
git push
```

Vercel automatically redeploys every time you push to GitHub! Magic! ✨

---

## 🐛 Common Problems & Fixes

| Problem | Fix |
|---------|-----|
| `npm: command not found` | Node.js isn't installed or not in PATH. Reinstall Node.js and restart terminal. |
| `Supabase credentials not configured` | Check your `.env.local` file has the right values |
| `No records found` | Upload all 3 CSV files first before running reconciliation |
| Upload says "0 rows" | Make sure CSV has headers: `txn_id,amount,date` |
| Vercel deploy fails | Check that environment variables are set correctly in Vercel dashboard |
| `git: command not found` | Install Git from https://git-scm.com |

---

## 📁 What Each File Does (Quick Reference)

| File | What It Does |
|------|-------------|
| `src/app/page.js` | The upload page (home page) |
| `src/app/reconcile/page.js` | The reconcile button page |
| `src/app/results/page.js` | The results dashboard |
| `src/app/api/upload/route.js` | Handles CSV uploads to database |
| `src/app/api/reconcile/route.js` | The matching engine (Pass 1 + Pass 2) |
| `src/app/api/results/route.js` | Fetches results from database |
| `src/app/api/export/route.js` | Downloads audit log as CSV/JSON |
| `src/lib/supabase.js` | Connects to Supabase (server-side) |
| `src/lib/grok.js` | Calls Grok AI for ambiguous matches |
| `scripts/generate_data.js` | Creates test CSV files |
| `.env.local` | Your secret API keys (NEVER share this!) |

---

## ✅ Hackathon Submission Checklist

- [ ] App deployed and accessible via URL
- [ ] Can upload 3 CSV files
- [ ] Can run reconciliation
- [ ] Shows match rate % and exceptions
- [ ] AI analysis works for ambiguous cases
- [ ] Can export audit log
- [ ] Handles errors gracefully (empty CSV, duplicates, API failures)
- [ ] README with setup instructions
