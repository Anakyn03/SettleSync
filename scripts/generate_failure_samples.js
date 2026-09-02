const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'data', 'samples');
fs.mkdirSync(OUT, { recursive: true });

function write(name, rows) {
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const [src, data] of Object.entries(rows)) {
    const content = typeof data === 'string' ? data : ['txn_id,amount,date', ...data.map(r => r.join(','))].join('\n');
    fs.writeFileSync(path.join(dir, `${src}.csv`), content);
  }
  console.log(`  ${name}: created`);
}

// 1. Malformed CSV — broken quotes, missing fields
write('09-malformed', {
  razorpay: 'txn_id,amount,date\nINV001,5000,2026-08-20\nINV002,,2026-08-21\n,3000,2026-08-22\nINV003,abc,2026-08-23\nINV004,4000,\n"unclosed quote,5000,2026-08-24\nINV005,6000,not-a-date',
  bank: 'txn_id,amount,date\nINV001,4900,2026-08-20\nINV002,2500,2026-08-21',
  internal: 'txn_id,amount,date\nINV001,5000,2026-08-20',
});

// 2. Empty files — just headers, no data
write('10-empty', {
  razorpay: 'txn_id,amount,date',
  bank: 'txn_id,amount,date',
  internal: 'txn_id,amount,date',
});

// 3. Wrong headers — column names don't match expected
write('11-wrong-columns', {
  razorpay: 'payment_id,value,created_at,description\nPAY001,5000,2026-08-20,Razorpay payment\nPAY002,3000,2026-08-21,Store sale',
  bank: 'reference,debit,txn_date,narration\nREF001,4900,2026-08-20,NEFT credit\nREF002,3000,2026-08-21,UPI received',
  internal: 'order_id,total,order_date,customer\nORD001,5000,2026-08-20,Customer A\nORD002,3000,2026-08-21,Customer B',
});

// 4. Massive duplicates — same txn_id repeated many times
write('12-heavy-duplicates', {
  razorpay: [
    ['DUP001', '5000', '2026-08-20'],
    ['DUP001', '5000', '2026-08-20'],
    ['DUP001', '5000', '2026-08-20'],
    ['DUP002', '3000', '2026-08-21'],
    ['DUP002', '3000', '2026-08-21'],
    ['DUP003', '7000', '2026-08-22'],
  ],
  bank: [
    ['DUP001', '4900', '2026-08-20'],
    ['DUP002', '2940', '2026-08-21'],
    ['DUP003', '6860', '2026-08-22'],
  ],
  internal: [
    ['DUP001', '5000', '2026-08-20'],
    ['DUP002', '3000', '2026-08-21'],
    ['DUP003', '7000', '2026-08-22'],
  ],
});

// 5. Special characters and edge values
write('13-special-chars', {
  razorpay: [
    ['TXN/001,extra', '5000.00', '2026-08-20'],
    ['TXN"002', '0.01', '2026-08-21'],
    ['TXN,003', '999999.99', '2026-08-22'],
    ['TXN 004', '-100', '2026-08-23'],
    ['"TXN""005"', '0', '2026-08-24'],
  ],
  bank: [
    ['TXN/001,extra', '4900.00', '2026-08-20'],
    ['TXN"002', '0.01', '2026-08-21'],
    ['TXN,003', '979999.99', '2026-08-22'],
  ],
  internal: [
    ['TXN/001,extra', '5000.00', '2026-08-20'],
    ['TXN"002', '0.01', '2026-08-21'],
  ],
});

console.log('\nDone! 5 failure scenarios created in public/data/samples/');
