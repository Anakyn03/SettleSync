/**
 * Generates 10 test folders with realistic business dates.
 * Each folder has: razorpay_settlement.csv, bank_statement.csv, internal_orders.csv
 *
 * Run: node scripts/generate_test_folders.js
 * Output: public/data/test_folders/
 */

const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, '..', 'public', 'data', 'test_folders')

// ── Business calendar: Mon-Fri, Aug 11 – Aug 29, 2026 (all UTC) ──
const BIZ_DAYS = []
{
  for (let day = 11; day <= 29; day++) {
    const d = new Date(Date.UTC(2026, 7, day))
    const dow = d.getUTCDay()
    if (dow >= 1 && dow <= 5) BIZ_DAYS.push(d)
  }
}
function fmt(d) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addBizDays(d, n) {
  const r = new Date(d.getTime())
  let added = 0
  while (added < n) {
    r.setUTCDate(r.getUTCDate() + 1)
    if (r.getUTCDay() >= 1 && r.getUTCDay() <= 5) added++
  }
  return r
}
function pick(i) { return new Date(BIZ_DAYS[i % BIZ_DAYS.length].getTime()) }
function rnd(min, max) { return Math.round((Math.random() * (max - min) + min) * 100) / 100 }

function csv(headers, rows) {
  const lines = [headers.join(',')]
  for (const row of rows) lines.push(row.map(v => v == null ? '' : String(v)).join(','))
  return lines.join('\n') + '\n'
}

const H = ['txn_id', 'amount', 'date']

const folders = []

// ── 01: Perfect match ──
folders.push({
  name: '01_perfect_match',
  desc: 'All records match exactly across 3 sources',
  generate() {
    const n = 50
    const rRows = [], bRows = [], iRows = []
    for (let i = 0; i < n; i++) {
      const id = `TXN${String(i + 1).padStart(4, '0')}`
      const amt = rnd(100, 50000).toFixed(2)
      const d = fmt(pick(i))
      rRows.push([id, amt, d])
      bRows.push([id, amt, d])
      iRows.push([id, amt, d])
    }
    return { razorpay: csv(H, rRows), bank: csv(H, bRows), internal: csv(H, iRows) }
  },
})

// ── 02: Fee-adjusted (bank 2% fee, next business day) ──
folders.push({
  name: '02_fee_adjusted',
  desc: 'Bank applies 2% fee, settles next business day',
  generate() {
    const n = 40
    const rRows = [], bRows = [], iRows = []
    for (let i = 0; i < n; i++) {
      const id = `PAY${String(i + 1).padStart(4, '0')}`
      const amt = rnd(500, 100000)
      const rzDate = pick(i)
      rRows.push([id, amt.toFixed(2), fmt(rzDate)])
      bRows.push([id, (amt * 0.98).toFixed(2), fmt(addBizDays(rzDate, 1))])
      iRows.push([id, amt.toFixed(2), fmt(rzDate)])
    }
    return { razorpay: csv(H, rRows), bank: csv(H, bRows), internal: csv(H, iRows) }
  },
})

// ── 03: Date-shifted (bank 2-3 days late) ──
folders.push({
  name: '03_date_shifted',
  desc: 'Bank records arrive 2-3 business days late',
  generate() {
    const n = 60
    const rRows = [], bRows = [], iRows = []
    for (let i = 0; i < n; i++) {
      const id = `INV${String(i + 1).padStart(5, '0')}`
      const amt = rnd(1000, 80000)
      const rzDate = pick(i)
      const lag = [2, 2, 3][i % 3]
      rRows.push([id, amt.toFixed(2), fmt(rzDate)])
      bRows.push([id, amt.toFixed(2), fmt(addBizDays(rzDate, lag))])
      iRows.push([id, amt.toFixed(2), fmt(rzDate)])
    }
    return { razorpay: csv(H, rRows), bank: csv(H, bRows), internal: csv(H, iRows) }
  },
})

// ── 04: Mixed realistic ──
folders.push({
  name: '04_mixed_realistic',
  desc: '60% exact, 20% fee-adjusted, 10% date-shifted, 10% orphans',
  generate() {
    const n = 80
    const rRows = [], bRows = [], iRows = []
    for (let i = 0; i < n; i++) {
      const id = `TXN${String(i + 1).padStart(4, '0')}`
      const amt = rnd(200, 90000)
      const d = fmt(pick(i))

      if (i < 48) {
        // Exact
        rRows.push([id, amt.toFixed(2), d])
        bRows.push([id, amt.toFixed(2), d])
        iRows.push([id, amt.toFixed(2), d])
      } else if (i < 64) {
        // Fee-adjusted
        rRows.push([id, amt.toFixed(2), d])
        bRows.push([id, (amt * 0.975).toFixed(2), fmt(addBizDays(new Date(d), 1))])
        iRows.push([id, amt.toFixed(2), d])
      } else if (i < 72) {
        // Date-shifted
        rRows.push([id, amt.toFixed(2), d])
        bRows.push([id, amt.toFixed(2), fmt(addBizDays(new Date(d), 3))])
        iRows.push([id, amt.toFixed(2), d])
      } else {
        // Orphan — only in razorpay
        rRows.push([id, amt.toFixed(2), d])
      }
    }
    return { razorpay: csv(H, rRows), bank: csv(H, bRows), internal: csv(H, iRows) }
  },
})

// ── 05: Duplicates within source ──
folders.push({
  name: '05_duplicates',
  desc: 'Some txn_ids appear twice in razorpay (data entry error)',
  generate() {
    const rRows = [], bRows = [], iRows = []
    for (let i = 0; i < 50; i++) {
      const id = `DUP${String(i + 1).padStart(4, '0')}`
      const amt = rnd(500, 30000)
      const d = fmt(pick(i))
      rRows.push([id, amt.toFixed(2), d])
      bRows.push([id, amt.toFixed(2), d])
      iRows.push([id, amt.toFixed(2), d])
    }
    // Add 10 duplicates in razorpay
    for (let i = 0; i < 10; i++) {
      const id = `DUP${String(i + 1).padStart(4, '0')}`
      rRows.push([id, rnd(500, 30000).toFixed(2), fmt(pick(i + 5))])
    }
    return { razorpay: csv(H, rRows), bank: csv(H, bRows), internal: csv(H, iRows) }
  },
})

// ── 06: Empty files ──
folders.push({
  name: '06_empty_files',
  desc: 'All CSVs have headers only, no data',
  razorpay: csv(H, []),
  bank: csv(H, []),
  internal: csv(H, []),
})

// ── 07: Wrong headers ──
folders.push({
  name: '07_wrong_headers',
  desc: 'Column names dont match expected (column mapping test)',
  razorpay: csv(['payment_id', 'value', 'created_at'], [
    ['PAY0001', 5000, '2026-08-14'],
    ['PAY0002', 12000, '2026-08-15'],
    ['PAY0003', 800, '2026-08-18'],
  ]),
  bank: csv(['ref', 'total', 'txn_date'], [
    ['PAY0001', 5000, '2026-08-14'],
    ['PAY0002', 12000, '2026-08-15'],
    ['PAY0003', 800, '2026-08-18'],
  ]),
  internal: csv(['order_number', 'price', 'timestamp'], [
    ['PAY0001', 5000, '2026-08-14'],
    ['PAY0002', 12000, '2026-08-15'],
    ['PAY0003', 800, '2026-08-18'],
  ]),
})

// ── 08: Large dataset (500 per source) ──
folders.push({
  name: '08_large_500',
  desc: '500 records per source with mixed match types',
  generate() {
    const n = 500
    const rRows = [], bRows = [], iRows = []
    for (let i = 0; i < n; i++) {
      const id = `L${String(i + 1).padStart(5, '0')}`
      const amt = rnd(10, 200000)
      const d = fmt(pick(i))

      if (i < 350) {
        // Exact
        rRows.push([id, amt.toFixed(2), d])
        bRows.push([id, amt.toFixed(2), d])
        iRows.push([id, amt.toFixed(2), d])
      } else if (i < 425) {
        // Fee-adjusted
        rRows.push([id, amt.toFixed(2), d])
        bRows.push([id, (amt * 0.98).toFixed(2), fmt(addBizDays(new Date(d), 1))])
        iRows.push([id, amt.toFixed(2), d])
      } else if (i < 460) {
        // Date-shifted
        rRows.push([id, amt.toFixed(2), d])
        bRows.push([id, amt.toFixed(2), fmt(addBizDays(new Date(d), 2))])
        iRows.push([id, amt.toFixed(2), d])
      } else {
        // Orphan
        rRows.push([id, amt.toFixed(2), d])
        if (Math.random() > 0.5) bRows.push([id, amt.toFixed(2), d])
        else iRows.push([id, amt.toFixed(2), d])
      }
    }
    return { razorpay: csv(H, rRows), bank: csv(H, bRows), internal: csv(H, iRows) }
  },
})

// ── 09: Special characters ──
folders.push({
  name: '09_special_chars',
  desc: 'Special chars in IDs, edge amounts, negative values',
  razorpay: csv(H, [
    ['TXN-001/A', 1000, '2026-08-14'],
    ['TXN.002.B', 0.01, '2026-08-15'],
    ['TXN 003 C', 999999.99, '2026-08-18'],
    ['"TXN,004"', 5000, '2026-08-19'],
    ['TXN_005', 0, '2026-08-20'],
    ['UPPERCASE', 10000, '2026-08-21'],
    ['lowercase', 20000, '2026-08-22'],
    ['MiXeD CaSe', 30000, '2026-08-25'],
  ]),
  bank: csv(H, [
    ['TXN-001/A', 1000, '2026-08-14'],
    ['TXN.002.B', 0.01, '2026-08-15'],
    ['TXN 003 C', 999999.99, '2026-08-18'],
    ['"TXN,004"', 5000, '2026-08-19'],
    ['TXN_005', 0, '2026-08-20'],
    ['UPPERCASE', 10000, '2026-08-21'],
    ['lowercase', 20000, '2026-08-22'],
    ['MiXeD CaSe', 30000, '2026-08-25'],
  ]),
  internal: csv(H, [
    ['TXN-001/A', 1000, '2026-08-14'],
    ['TXN.002.B', 0.01, '2026-08-15'],
    ['TXN 003 C', 999999.99, '2026-08-18'],
    ['"TXN,004"', 5000, '2026-08-19'],
    ['TXN_005', 0, '2026-08-20'],
    ['UPPERCASE', 10000, '2026-08-21'],
    ['lowercase', 20000, '2026-08-22'],
    ['MiXeD CaSe', 30000, '2026-08-25'],
  ]),
})

// ── 10: No matches ──
folders.push({
  name: '10_no_matches',
  desc: 'Different txn_ids across sources — zero matches expected',
  generate() {
    const n = 30
    const rRows = Array.from({ length: n }, (_, i) => [`R${String(i + 1).padStart(4, '0')}`, rnd(100, 10000).toFixed(2), fmt(pick(i))])
    const bRows = Array.from({ length: n }, (_, i) => [`B${String(i + 1).padStart(4, '0')}`, rnd(100, 10000).toFixed(2), fmt(pick(i))])
    const iRows = Array.from({ length: n }, (_, i) => [`I${String(i + 1).padStart(4, '0')}`, rnd(100, 10000).toFixed(2), fmt(pick(i))])
    return { razorpay: csv(H, rRows), bank: csv(H, bRows), internal: csv(H, iRows) }
  },
})

// ── Generate all folders ──
console.log('Generating 10 test folders...\n')

for (const folder of folders) {
  const dir = path.join(OUT, folder.name)
  fs.mkdirSync(dir, { recursive: true })

  const data = folder.generate ? folder.generate() : {
    razorpay: folder.razorpay, bank: folder.bank, internal: folder.internal,
  }

  fs.writeFileSync(path.join(dir, 'razorpay_settlement.csv'), data.razorpay)
  fs.writeFileSync(path.join(dir, 'bank_statement.csv'), data.bank)
  fs.writeFileSync(path.join(dir, 'internal_orders.csv'), data.internal)

  const rLines = data.razorpay.trim().split('\n').length - 1
  const bLines = data.bank.trim().split('\n').length - 1
  const iLines = data.internal.trim().split('\n').length - 1
  console.log(`${folder.name.padEnd(25)} R:${String(rLines).padStart(4)} B:${String(bLines).padStart(4)} I:${String(iLines).padStart(4)}  ${folder.desc}`)
}

console.log(`\nDone! 10 folders created in ${OUT}`)
console.log('\nUsage:')
console.log('  1. Go to http://localhost:3000/upload')
console.log('  2. Click "Upload your CSVs"')
console.log('  3. Select all 3 CSVs from a test folder')
console.log('  4. Map columns and upload')
