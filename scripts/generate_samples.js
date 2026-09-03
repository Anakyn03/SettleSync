const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, '..', 'public', 'data', 'samples')
fs.mkdirSync(OUT, { recursive: true })

// ── Business calendar: Mon-Fri only, Aug 11 – Aug 29, 2026 (all UTC) ──
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
function pick(arr, i) { return new Date(arr[i % arr.length].getTime()) }

function write(name, rows) {
  const dir = path.join(OUT, name)
  fs.mkdirSync(dir, { recursive: true })
  for (const [src, data] of Object.entries(rows)) {
    fs.writeFileSync(path.join(dir, `${src}.csv`),
      ['txn_id,amount,date', ...data.map(r => r.join(','))].join('\n'))
  }
  const n = Object.values(rows)[0].length
  console.log(`  ${name}: ${n} records per source`)
}

// ── 01: Perfect Match ──
// All 3 sources: same txn_id, same amount, same date
{
  const ids = Array.from({ length: 40 }, (_, i) => `TXN${String(i + 1).padStart(4, '0')}`)
  const mk = (amtFn) => ids.map((id, i) => [id, amtFn(i), fmt(pick(BIZ_DAYS, i))])
  write('01-perfect-match', {
    razorpay: mk(i => (1500 + i * 823.7) % 50000).map(r => [r[0], r[1].toFixed(2), r[2]]),
    bank:     mk(i => (1500 + i * 823.7) % 50000).map(r => [r[0], r[1].toFixed(2), r[2]]),
    internal: mk(i => (1500 + i * 823.7) % 50000).map(r => [r[0], r[1].toFixed(2), r[2]]),
  })
}

// ── 02: Fee Adjusted (bank takes 2% fee, settles next business day) ──
{
  const ids = Array.from({ length: 35 }, (_, i) => `INV${String(i + 1).padStart(4, '0')}`)
  const razorpay = ids.map((id, i) => {
    const amt = (2000 + i * 1234.56) % 80000
    return [id, amt.toFixed(2), fmt(pick(BIZ_DAYS, i))]
  })
  const bank = ids.map((id, i) => {
    const rzAmt = Number(razorpay[i][1])
    const bankAmt = (rzAmt * 0.98).toFixed(2)
    const rzDate = new Date(razorpay[i][2])
    return [id, bankAmt, fmt(addBizDays(rzDate, 1))]
  })
  const internal = ids.map((id, i) => {
    const amt = (2000 + i * 1234.56) % 80000
    return [id, amt.toFixed(2), fmt(pick(BIZ_DAYS, i))]
  })
  write('02-fee-adjusted', { razorpay, bank, internal })
}

// ── 03: Date Shifted (bank settles 2-4 business days late, same amount) ──
{
  const ids = Array.from({ length: 45 }, (_, i) => `PAY${String(i + 1).padStart(4, '0')}`)
  const razorpay = ids.map((id, i) => {
    const amt = (3000 + i * 987.32) % 60000
    return [id, amt.toFixed(2), fmt(pick(BIZ_DAYS, i))]
  })
  const bank = ids.map((id, i) => {
    const rzDate = new Date(razorpay[i][2])
    const lag = [2, 3, 3, 4][i % 4]
    return [id, razorpay[i][1], fmt(addBizDays(rzDate, lag))]
  })
  const internal = ids.map((id, i) => {
    const amt = (3000 + i * 987.32) % 60000
    return [id, amt.toFixed(2), fmt(pick(BIZ_DAYS, i))]
  })
  write('03-date-shifted', { razorpay, bank, internal })
}

// ── 04: Mixed Realistic ──
// 60% exact, 20% fee-adjusted, 10% date-shifted, 10% orphan
{
  const ids = Array.from({ length: 50 }, (_, i) => `ORD${String(i + 1).padStart(4, '0')}`)
  const rRows = [], bRows = [], iRows = []

  for (let i = 0; i < 50; i++) {
    const id = ids[i]
    const amt = (1000 + i * 1567.89) % 70000
    const date = fmt(pick(BIZ_DAYS, i))

    if (i < 30) {
      // Exact — same in all 3
      rRows.push([id, amt.toFixed(2), date])
      bRows.push([id, amt.toFixed(2), date])
      iRows.push([id, amt.toFixed(2), date])
    } else if (i < 40) {
      // Fee-adjusted — bank takes 2%, settles next day
      rRows.push([id, amt.toFixed(2), date])
      bRows.push([id, (amt * 0.98).toFixed(2), fmt(addBizDays(new Date(date), 1))])
      iRows.push([id, amt.toFixed(2), date])
    } else if (i < 45) {
      // Date-shifted — bank 3 days late
      rRows.push([id, amt.toFixed(2), date])
      bRows.push([id, amt.toFixed(2), fmt(addBizDays(new Date(date), 3))])
      iRows.push([id, amt.toFixed(2), date])
    } else {
      // Orphan — only in razorpay
      rRows.push([id, amt.toFixed(2), date])
    }
  }
  write('04-mixed', { razorpay: rRows, bank: bRows, internal: iRows })
}

// ── 05: No Matches ──
// Completely different txn_ids across sources
{
  const rIds = Array.from({ length: 25 }, (_, i) => `R${String(i + 1).padStart(4, '0')}`)
  const bIds = Array.from({ length: 25 }, (_, i) => `B${String(i + 1).padStart(4, '0')}`)
  const iIds = Array.from({ length: 25 }, (_, i) => `I${String(i + 1).padStart(4, '0')}`)
  write('05-no-matches', {
    razorpay: rIds.map((id, i) => [id, ((500 + i * 2000) % 30000).toFixed(2), fmt(pick(BIZ_DAYS, i))]),
    bank:     bIds.map((id, i) => [id, ((800 + i * 1800) % 28000).toFixed(2), fmt(pick(BIZ_DAYS, i))]),
    internal: iIds.map((id, i) => [id, ((600 + i * 2200) % 32000).toFixed(2), fmt(pick(BIZ_DAYS, i))]),
  })
}

// ── 06: Large Dataset (200 per source) ──
{
  const ids = Array.from({ length: 200 }, (_, i) => `TXN${String(i + 1).padStart(5, '0')}`)
  const mk = () => ids.map((id, i) => {
    const amt = (100 + i * 478.91) % 100000
    return [id, amt.toFixed(2), fmt(pick(BIZ_DAYS, i))]
  })
  write('06-large', { razorpay: mk(), bank: mk(), internal: mk() })
}

// ── 07: Edge Amounts ──
{
  const amounts = [0.01, 1.00, 10.00, 100.00, 999.99, 1000.00, 5000.00, 10000.00, 50000.00, 999999.99]
  const ids = amounts.map((_, i) => `EDGE${String(i + 1).padStart(3, '0')}`)
  const mk = () => ids.map((id, i) => [id, amounts[i].toFixed(2), fmt(pick(BIZ_DAYS, i))])
  write('07-edge-amounts', { razorpay: mk(), bank: mk(), internal: mk() })
}

// ── 08: With Duplicates ──
{
  const ids = Array.from({ length: 30 }, (_, i) => `STR${String(i + 1).padStart(4, '0')}`)
  const mk = () => {
    const rows = ids.map((id, i) => [id, ((1000 + i * 1500) % 25000).toFixed(2), fmt(pick(BIZ_DAYS, i))])
    // Add 10 duplicates (same txn_id, different amount — realistic data entry error)
    for (let i = 0; i < 10; i++) {
      rows.push([ids[i], ((1000 + i * 1500 + 500) % 25000).toFixed(2), fmt(pick(BIZ_DAYS, i + 5))])
    }
    return rows
  }
  write('08-with-duplicates', { razorpay: mk(), bank: mk(), internal: mk() })
}

console.log('\nDone! 8 normal scenarios created in public/data/samples/')
