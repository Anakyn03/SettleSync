/**
 * Generates 10 test folders with diverse CSV datasets.
 * Each folder has: razorpay_settlement.csv, bank_statement.csv, internal_orders.csv
 * 
 * Run: node scripts/generate_test_folders.js
 * Output: public/data/test_folders/
 */

const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, '..', 'public', 'data', 'test_folders')

function csv(headers, rows) {
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(row.map(v => v == null ? '' : String(v)).join(','))
  }
  return lines.join('\n') + '\n'
}

function rnd(min, max) { return Math.round((Math.random() * (max - min) + min) * 100) / 100 }
function rndInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function dateStr(d) { return d.toISOString().split('T')[0] }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

const today = new Date('2026-08-20')
const H = ['txn_id', 'amount', 'date']

const folders = []

// ── 01: Perfect match — all 3 sources, exact matches ──
folders.push({
  name: '01_perfect_match',
  desc: 'All records match exactly across 3 sources',
  razorpay: (n) => {
    const rows = []
    for (let i = 1; i <= n; i++) rows.push([`TXN${String(i).padStart(4, '0')}`, rnd(100, 50000), dateStr(addDays(today, -(i % 30)))])
    return csv(H, rows)
  },
  bank: (n) => {
    const rows = []
    for (let i = 1; i <= n; i++) rows.push([`TXN${String(i).padStart(4, '0')}`, rnd(100, 50000), dateStr(addDays(today, -(i % 30)))])
    return csv(H, rows)
  },
  internal: (n) => {
    const rows = []
    for (let i = 1; i <= n; i++) rows.push([`TXN${String(i).padStart(4, '0')}`, rnd(100, 50000), dateStr(addDays(today, -(i % 30)))])
    return csv(H, rows)
  },
  sizes: [50, 50, 50],
})

// ── 02: Fee-adjusted — bank has 2% fee, internal exact ──
folders.push({
  name: '02_fee_adjusted',
  desc: 'Bank applies 2% fee on all transactions',
  razorpay: (n) => {
    const rows = []
    for (let i = 1; i <= n; i++) {
      const amt = rnd(500, 100000)
      rows.push([`PAY${String(i).padStart(4, '0')}`, amt, dateStr(addDays(today, -(i % 20)))])
    }
    return csv(H, rows)
  },
  bank: (n) => {
    const rows = []
    for (let i = 1; i <= n; i++) {
      const amt = rnd(500, 100000)
      rows.push([`PAY${String(i).padStart(4, '0')}`, +(amt * 0.98).toFixed(2), dateStr(addDays(today, -(i % 20) + 1))])
    }
    return csv(H, rows)
  },
  internal: (n) => {
    const rows = []
    for (let i = 1; i <= n; i++) {
      const amt = rnd(500, 100000)
      rows.push([`PAY${String(i).padStart(4, '0')}`, amt, dateStr(addDays(today, -(i % 20)))])
    }
    return csv(H, rows)
  },
  sizes: [40, 40, 40],
})

// ── 03: Date-shifted — bank settlement delayed 1-2 days ──
folders.push({
  name: '03_date_shifted',
  desc: 'Bank records arrive 1-2 days late',
  razorpay: (n) => {
    const rows = []
    for (let i = 1; i <= n; i++) rows.push([`INV${String(i).padStart(5, '0')}`, rnd(1000, 80000), dateStr(addDays(today, -(i % 25)))])
    return csv(H, rows)
  },
  bank: (n) => {
    const rows = []
    for (let i = 1; i <= n; i++) rows.push([`INV${String(i).padStart(5, '0')}`, rnd(1000, 80000), dateStr(addDays(today, -(i % 25) + rndInt(1, 2)))])
    return csv(H, rows)
  },
  internal: (n) => {
    const rows = []
    for (let i = 1; i <= n; i++) rows.push([`INV${String(i).padStart(5, '0')}`, rnd(1000, 80000), dateStr(addDays(today, -(i % 25)))])
    return csv(H, rows)
  },
  sizes: [60, 60, 60],
})

// ── 04: Mixed — some exact, some fee, some date-shifted, some orphan ──
folders.push({
  name: '04_mixed_realistic',
  desc: 'Realistic mix: 60% exact, 20% fee-adjusted, 10% date-shifted, 10% orphans',
  generate() {
    const rRows = [], bRows = [], iRows = []
    const n = 80
    for (let i = 1; i <= n; i++) {
      const id = `TXN${String(i).padStart(4, '0')}`
      const amt = rnd(200, 90000)
      const d = dateStr(addDays(today, -(i % 28)))
      const roll = Math.random()

      if (roll < 0.6) {
        // Exact match in all 3
        rRows.push([id, amt, d])
        bRows.push([id, amt, d])
        iRows.push([id, amt, d])
      } else if (roll < 0.8) {
        // Fee-adjusted in bank
        rRows.push([id, amt, d])
        bRows.push([id, +(amt * 0.975).toFixed(2), dateStr(addDays(new Date(d), 1))])
        iRows.push([id, amt, d])
      } else if (roll < 0.9) {
        // Date-shifted
        rRows.push([id, amt, d])
        bRows.push([id, amt, dateStr(addDays(new Date(d), 2))])
        iRows.push([id, amt, d])
      } else {
        // Orphan — only in razorpay
        rRows.push([id, amt, d])
      }
    }
    return {
      razorpay: csv(H, rRows),
      bank: csv(H, bRows),
      internal: csv(H, iRows),
    }
  },
})

// ── 05: Duplicate IDs within same source ──
folders.push({
  name: '05_duplicates',
  desc: 'Some txn_ids appear twice in same source (duplicates should be skipped)',
  generate() {
    const rRows = [], bRows = [], iRows = []
    for (let i = 1; i <= 50; i++) {
      const id = `DUP${String(i).padStart(4, '0')}`
      const amt = rnd(500, 30000)
      const d = dateStr(addDays(today, -(i % 15)))
      rRows.push([id, amt, d])
      bRows.push([id, amt, d])
      iRows.push([id, amt, d])
    }
    // Add duplicates in razorpay
    for (let i = 1; i <= 10; i++) {
      const id = `DUP${String(i).padStart(4, '0')}`
      rRows.push([id, rnd(500, 30000), dateStr(addDays(today, -5))])
    }
    return { razorpay: csv(H, rRows), bank: csv(H, bRows), internal: csv(H, iRows) }
  },
})

// ── 06: Empty and null CSVs ──
folders.push({
  name: '06_empty_files',
  desc: 'One or more CSVs are empty or have only headers',
  razorpay: csv(H, []),
  bank: csv(H, []),
  internal: csv(H, []),
})

// ── 07: Malformed headers ──
folders.push({
  name: '07_wrong_headers',
  desc: 'Headers dont match expected names (column mapping test)',
  razorpay: csv(['payment_id', 'value', 'created_at'], [
    ['PAY0001', 5000, '2026-08-15'],
    ['PAY0002', 12000, '2026-08-16'],
    ['PAY0003', 800, '2026-08-17'],
  ]),
  bank: csv(['ref', 'total', 'txn_date'], [
    ['PAY0001', 5000, '2026-08-15'],
    ['PAY0002', 12000, '2026-08-16'],
    ['PAY0003', 800, '2026-08-17'],
  ]),
  internal: csv(['order_number', 'price', 'timestamp'], [
    ['PAY0001', 5000, '2026-08-15'],
    ['PAY0002', 12000, '2026-08-16'],
    ['PAY0003', 800, '2026-08-17'],
  ]),
})

// ── 08: Large dataset — 500 records each ──
folders.push({
  name: '08_large_500',
  desc: '500 records per source with mixed match types',
  generate() {
    const rRows = [], bRows = [], iRows = []
    for (let i = 1; i <= 500; i++) {
      const id = `L${String(i).padStart(5, '0')}`
      const amt = rnd(10, 200000)
      const d = dateStr(addDays(today, -(i % 60)))
      const roll = Math.random()
      rRows.push([id, amt, d])
      if (roll < 0.7) {
        bRows.push([id, amt, d])
        iRows.push([id, amt, d])
      } else if (roll < 0.85) {
        bRows.push([id, +(amt * 0.98).toFixed(2), dateStr(addDays(new Date(d), 1))])
        iRows.push([id, amt, d])
      } else if (roll < 0.92) {
        bRows.push([id, amt, dateStr(addDays(new Date(d), 2))])
        iRows.push([id, amt, d])
      } else {
        // Orphan in one source only
        if (Math.random() > 0.5) bRows.push([id, amt, d])
        else iRows.push([id, amt, d])
      }
    }
    return { razorpay: csv(H, rRows), bank: csv(H, bRows), internal: csv(H, iRows) }
  },
})

// ── 09: Special characters and edge amounts ──
folders.push({
  name: '09_special_chars',
  desc: 'Amounts with commas, special chars in IDs, very large/small values',
  razorpay: csv(H, [
    ['TXN-001/A', 1000, '2026-08-20'],
    ['TXN.002.B', 0.01, '2026-08-20'],
    ['TXN 003 C', 999999.99, '2026-08-20'],
    ['"TXN,004"', 5000, '2026-08-21'],
    ['TXN_005', 0, '2026-08-22'],
    ['UPPERCASE', 10000, '2026-08-23'],
    ['lowercase', 20000, '2026-08-24'],
    ['MiXeD CaSe', 30000, '2026-08-25'],
  ]),
  bank: csv(H, [
    ['TXN-001/A', 1000, '2026-08-20'],
    ['TXN.002.B', 0.01, '2026-08-20'],
    ['TXN 003 C', 999999.99, '2026-08-20'],
    ['"TXN,004"', 5000, '2026-08-21'],
    ['TXN_005', 0, '2026-08-22'],
    ['UPPERCASE', 10000, '2026-08-23'],
    ['lowercase', 20000, '2026-08-24'],
    ['MiXeD CaSe', 30000, '2026-08-25'],
  ]),
  internal: csv(H, [
    ['TXN-001/A', 1000, '2026-08-20'],
    ['TXN.002.B', 0.01, '2026-08-20'],
    ['TXN 003 C', 999999.99, '2026-08-20'],
    ['"TXN,004"', 5000, '2026-08-21'],
    ['TXN_005', 0, '2026-08-22'],
    ['UPPERCASE', 10000, '2026-08-23'],
    ['lowercase', 20000, '2026-08-24'],
    ['MiXeD CaSe', 30000, '2026-08-25'],
  ]),
})

// ── 10: Stress — no matches at all (completely different txn_ids) ──
folders.push({
  name: '10_no_matches',
  desc: 'All sources have different txn_ids — zero matches expected',
  razorpay: csv(H, Array.from({ length: 30 }, (_, i) => [`R${String(i + 1).padStart(4, '0')}`, rnd(100, 10000), dateStr(addDays(today, -(i % 10)))])),
  bank: csv(H, Array.from({ length: 30 }, (_, i) => [`B${String(i + 1).padStart(4, '0')}`, rnd(100, 10000), dateStr(addDays(today, -(i % 10)))])),
  internal: csv(H, Array.from({ length: 30 }, (_, i) => [`I${String(i + 1).padStart(4, '0')}`, rnd(100, 10000), dateStr(addDays(today, -(i % 10)))])),
})

// ── Generate all folders ──
console.log('Generating 10 test folders...\n')

for (const folder of folders) {
  const dir = path.join(OUT, folder.name)
  fs.mkdirSync(dir, { recursive: true })

  let rCsv, bCsv, iCsv

  if (folder.generate) {
    const data = folder.generate()
    rCsv = data.razorpay; bCsv = data.bank; iCsv = data.internal
  } else if (folder.sizes) {
    rCsv = folder.razorpay(folder.sizes[0])
    bCsv = folder.bank(folder.sizes[1])
    iCsv = folder.internal(folder.sizes[2])
  } else {
    rCsv = folder.razorpay; bCsv = folder.bank; iCsv = folder.internal
  }

  fs.writeFileSync(path.join(dir, 'razorpay_settlement.csv'), rCsv)
  fs.writeFileSync(path.join(dir, 'bank_statement.csv'), bCsv)
  fs.writeFileSync(path.join(dir, 'internal_orders.csv'), iCsv)

  const rLines = rCsv.trim().split('\n').length - 1
  const bLines = bCsv.trim().split('\n').length - 1
  const iLines = iCsv.trim().split('\n').length - 1
  console.log(`${folder.name.padEnd(25)} R:${String(rLines).padStart(4)} B:${String(bLines).padStart(4)} I:${String(iLines).padStart(4)}  ${folder.desc}`)
}

console.log(`\nDone! 10 folders created in ${OUT}`)
console.log('\nUsage:')
console.log('  1. Go to http://localhost:3000/upload')
console.log('  2. Click "Upload your CSVs"')
console.log('  3. Select all 3 CSVs from a test folder')
console.log('  4. Map columns and upload')
