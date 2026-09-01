/**
 * Generate realistic sample CSV files for testing SettleSync.
 * Creates 3 source files with ~100 records each:
 * - razorpay_settlement.csv (payment gateway)
 * - bank_statement.csv (bank)
 * - internal_orders.csv (your system)
 * 
 * Usage: node scripts/generate_sample_data.js
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data', 'sample');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Helper functions
function genTxnId() {
  const prefix = ['TXN', 'ORD', 'PAY', 'INV'][Math.floor(Math.random() * 4)];
  return prefix + String(Math.floor(100000 + Math.random() * 900000));
}

function randomDate(baseDays, offsetDays) {
  const d = new Date('2026-08-15');
  d.setDate(d.getDate() + baseDays + Math.floor(Math.random() * offsetDays));
  return d.toISOString().split('T')[0];
}

function randomAmount(min, max) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

// Generate transactions
const NUM_TRANSACTIONS = 100;
const transactions = [];

for (let i = 0; i < NUM_TRANSACTIONS; i++) {
  const txnId = genTxnId();
  const amount = randomAmount(50, 50000);
  const date = randomDate(0, 15);
  
  // ~70% exact match (same across all 3 sources)
  // ~15% fee-adjusted (bank amount is lower, date +1)
  // ~10% missing from one source
  // ~5% orphan (only in one source)
  const rand = Math.random();
  
  let razorpay = { txn_id: txnId, amount, date, type: 'exact' };
  let bank = { txn_id: txnId, amount, date, type: 'exact' };
  let internal = { txn_id: txnId, amount, date, type: 'exact' };
  
  if (rand < 0.15) {
    // Fee-adjusted: bank has 2% fee, +1 day lag
    const fee = Math.round(amount * 0.02 * 100) / 100;
    bank.amount = Math.round((amount - fee) * 100) / 100;
    const bankDate = new Date(date);
    bankDate.setDate(bankDate.getDate() + 1);
    bank.date = bankDate.toISOString().split('T')[0];
    bank.type = 'fee-adjusted';
  } else if (rand < 0.25) {
    // Missing from one source
    const missingSource = Math.floor(Math.random() * 3);
    if (missingSource === 0) razorpay = null;
    else if (missingSource === 1) bank = null;
    else internal = null;
  } else if (rand < 0.30) {
    // Orphan: only in one source
    const onlySource = Math.floor(Math.random() * 3);
    if (onlySource !== 0) razorpay = null;
    if (onlySource !== 1) bank = null;
    if (onlySource !== 2) internal = null;
  }
  
  if (razorpay) transactions.push({ ...razorpay, source: 'razorpay' });
  if (bank) transactions.push({ ...bank, source: 'bank' });
  if (internal) transactions.push({ ...internal, source: 'internal' });
}

// Write CSV files
const sources = ['razorpay', 'bank', 'internal'];
for (const source of sources) {
  const records = transactions.filter(t => t.source === source);
  const csv = ['txn_id,amount,date'];
  records.forEach(r => {
    csv.push(`${r.txn_id},${r.amount},${r.date}`);
  });
  
  const filename = source === 'razorpay' ? 'razorpay_settlement.csv' :
                   source === 'bank' ? 'bank_statement.csv' : 'internal_orders.csv';
  
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), csv.join('\n'));
  console.log(`${filename}: ${records.length} records`);
}

// Also create CSVs with different column names (to test generic mapping)
const altDir = path.join(OUTPUT_DIR, 'alternative_columns');
if (!fs.existsSync(altDir)) fs.mkdirSync(altDir, { recursive: true });

// Stripe-style CSV
const stripeRecords = transactions.filter(t => t.source === 'razorpay').slice(0, 50);
const stripeCsv = ['payment_id,currency,created,status'];
stripeRecords.forEach(r => {
  stripeCsv.push(`${r.txn_id},INR,${r.datetime || r.date + 'T10:00:00Z'},succeeded`);
});
fs.writeFileSync(path.join(altDir, 'stripe_export.csv'), stripeCsv.join('\n'));
console.log('stripe_export.csv: 50 records (alternative column names)');

// Shopify-style CSV
const shopifyRecords = transactions.filter(t => t.source === 'internal').slice(0, 50);
const shopifyCsv = ['Order #,Total,Date,Financial Status'];
shopifyRecords.forEach(r => {
  shopifyCsv.push(`${r.txn_id},${r.amount},${r.date},paid`);
});
fs.writeFileSync(path.join(altDir, 'shopify_orders.csv'), shopifyCsv.join('\n'));
console.log('shopify_orders.csv: 50 records (alternative column names)');

// Summary
const allRecords = transactions;
console.log(`\nTotal records across all files: ${allRecords.length}`);
console.log(`Unique transaction IDs: ${new Set(allRecords.map(t => t.txn_id)).size}`);
console.log(`\nFiles saved to: ${OUTPUT_DIR}`);
console.log('\nTo test SettleSync:');
console.log('1. Go to http://localhost:3000/upload');
console.log('2. Upload razorpay_settlement.csv, bank_statement.csv, internal_orders.csv');
console.log('3. Map columns and run reconciliation');
