const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, '..', 'public', 'data', 'samples')
fs.mkdirSync(OUT, { recursive: true })

function write(name, rows) {
  const dir = path.join(OUT, name)
  fs.mkdirSync(dir, { recursive: true })
  for (const [src, data] of Object.entries(rows)) {
    const content = typeof data === 'string' ? data
      : ['txn_id,amount,date', ...data.map(r => r.join(','))].join('\n')
    fs.writeFileSync(path.join(dir, `${src}.csv`), content)
  }
  console.log(`  ${name}: created`)
}

// ── 09: Malformed CSV ──
// Realistic dates, but broken data in specific rows
write('09-malformed', {
  razorpay: [
    'txn_id,amount,date',
    'INV001,5000.00,2026-08-18',     // ✅ valid
    'INV002,,2026-08-19',             // ❌ missing amount
    ',3000.00,2026-08-20',            // ❌ missing txn_id
    'INV003,abc,2026-08-21',          // ❌ amount is text
    'INV004,4000.00,',                // ❌ missing date
    '"unclosed quote,5000,2026-08-22', // ❌ broken CSV formatting
    'INV005,6000.00,not-a-date',      // ❌ invalid date format
  ].join('\n'),
  bank: [
    'txn_id,amount,date',
    'INV001,4900.00,2026-08-19',
    'INV002,2500.00,2026-08-20',
  ].join('\n'),
  internal: [
    'txn_id,amount,date',
    'INV001,5000.00,2026-08-18',
  ].join('\n'),
})

// ── 10: Empty Files ──
write('10-empty', {
  razorpay: 'txn_id,amount,date',
  bank: 'txn_id,amount,date',
  internal: 'txn_id,amount,date',
})

// ── 11: Wrong Column Names ──
write('11-wrong-columns', {
  razorpay: [
    'payment_id,value,created_at,description',
    'PAY001,5000.00,2026-08-18,Razorpay payment',
    'PAY002,3000.00,2026-08-19,Store sale',
    'PAY003,8500.00,2026-08-20,Subscription',
  ].join('\n'),
  bank: [
    'reference,debit,txn_date,narration',
    'REF001,4900.00,2026-08-19,NEFT credit',
    'REF002,2940.00,2026-08-20,UPI received',
    'REF003,8330.00,2026-08-21,Card settlement',
  ].join('\n'),
  internal: [
    'order_id,total,order_date,customer',
    'ORD001,5000.00,2026-08-18,Customer A',
    'ORD002,3000.00,2026-08-19,Customer B',
    'ORD003,8500.00,2026-08-20,Customer C',
  ].join('\n'),
})

// ── 12: Heavy Duplicates ──
write('12-heavy-duplicates', {
  razorpay: [
    ['DUP001', '5000.00', '2026-08-18'],
    ['DUP001', '5000.00', '2026-08-18'],  // duplicate
    ['DUP001', '5000.00', '2026-08-18'],  // duplicate
    ['DUP002', '3000.00', '2026-08-19'],
    ['DUP002', '3000.00', '2026-08-19'],  // duplicate
    ['DUP003', '7000.00', '2026-08-20'],
  ],
  bank: [
    ['DUP001', '4900.00', '2026-08-19'],
    ['DUP002', '2940.00', '2026-08-20'],
    ['DUP003', '6860.00', '2026-08-21'],
  ],
  internal: [
    ['DUP001', '5000.00', '2026-08-18'],
    ['DUP002', '3000.00', '2026-08-19'],
    ['DUP003', '7000.00', '2026-08-20'],
  ],
})

// ── 13: Special Characters ──
write('13-special-chars', {
  razorpay: [
    ['TXN/001,extra', '5000.00', '2026-08-18'],
    ['TXN"002', '0.01', '2026-08-19'],
    ['TXN,003', '999999.99', '2026-08-20'],
    ['TXN 004', '-100.00', '2026-08-21'],
    ['"TXN""005"', '0.00', '2026-08-22'],
  ],
  bank: [
    ['TXN/001,extra', '4900.00', '2026-08-19'],
    ['TXN"002', '0.01', '2026-08-20'],
    ['TXN,003', '979999.99', '2026-08-21'],
  ],
  internal: [
    ['TXN/001,extra', '5000.00', '2026-08-18'],
    ['TXN"002', '0.01', '2026-08-19'],
  ],
})

console.log('\nDone! 5 failure scenarios created in public/data/samples/')
