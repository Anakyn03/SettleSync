const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'data', 'samples');
fs.mkdirSync(OUT, { recursive: true });

function write(name, rows) {
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const [src, data] of Object.entries(rows)) {
    fs.writeFileSync(path.join(dir, `${src}.csv`), ['txn_id,amount,date', ...data.map(r => r.join(','))].join('\n'));
  }
  console.log(`  ${name}: ${Object.values(rows)[0].length} records per source`);
}

function rng(seed) {
  let s = seed;
  return function() { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

function genIds(n, prefix, rand) {
  var ids = [];
  var seen = {};
  while (ids.length < n) {
    var id = prefix + String(Math.floor(rand() * 900000) + 100000);
    if (!seen[id]) { seen[id] = true; ids.push(id); }
  }
  return ids;
}

function genDate(rand, baseDays) {
  baseDays = baseDays || 0;
  var d = new Date(2026, 7, 15 + baseDays + Math.floor(rand() * 15));
  return d.toISOString().split('T')[0];
}

function genAmount(rand, min, max) {
  min = min || 500; max = max || 50000;
  return Math.round((min + rand() * (max - min)) * 100) / 100;
}

// 1. Perfect match
(function() {
  var r = rng(42);
  var ids = genIds(40, 'TXN', r);
  var mk = function() { return ids.map(function(id) { return [id, genAmount(r), genDate(r)]; }); };
  write('01-perfect-match', { razorpay: mk(), bank: mk(), internal: mk() });
})();

// 2. Fee-adjusted (bank takes 2% fee)
(function() {
  var r = rng(123);
  var ids = genIds(35, 'INV', r);
  var razorpay = ids.map(function(id) { return [id, genAmount(r), genDate(r)]; });
  var bank = ids.map(function(id, i) { return [id, (razorpay[i][1] * 0.98).toFixed(2), genDate(r, 1)]; });
  var internal = ids.map(function(id) { return [id, genAmount(r), genDate(r)]; });
  write('02-fee-adjusted', { razorpay: razorpay, bank: bank, internal: internal });
})();

// 3. Date-shifted (bank settles 2-3 days late)
(function() {
  var r = rng(456);
  var ids = genIds(45, 'PAY', r);
  var razorpay = ids.map(function(id) { return [id, genAmount(r), genDate(r)]; });
  var bank = ids.map(function(id, i) { return [id, razorpay[i][1], genDate(r, 2 + Math.floor(r() * 2))]; });
  var internal = ids.map(function(id) { return [id, genAmount(r), genDate(r)]; });
  write('03-date-shifted', { razorpay: razorpay, bank: bank, internal: internal });
})();

// 4. Mixed realistic
(function() {
  var r = rng(789);
  var exactIds = genIds(30, 'ORD', r);
  var feeIds = genIds(10, 'TXN', r);
  var shiftIds = genIds(5, 'PAY', r);
  var orphR = genIds(5, 'ORP', r);
  var orphB = genIds(5, 'MIS', r);

  var razorpay = {};
  exactIds.forEach(function(id) { razorpay[id] = genAmount(r); });
  feeIds.forEach(function(id) { razorpay[id] = genAmount(r); });
  shiftIds.forEach(function(id) { razorpay[id] = genAmount(r); });
  orphR.forEach(function(id) { razorpay[id] = genAmount(r); });

  var rRows = Object.keys(razorpay).map(function(id) { return [id, razorpay[id], genDate(r)]; });
  var bRows = [];
  exactIds.forEach(function(id) { bRows.push([id, razorpay[id], genDate(r)]); });
  feeIds.forEach(function(id) { bRows.push([id, (razorpay[id] * 0.98).toFixed(2), genDate(r, 1)]); });
  shiftIds.forEach(function(id) { bRows.push([id, razorpay[id], genDate(r, 2)]); });
  orphB.forEach(function(id) { bRows.push([id, genAmount(r), genDate(r)]); });
  var iRows = [];
  exactIds.forEach(function(id) { iRows.push([id, razorpay[id], genDate(r)]); });
  feeIds.forEach(function(id) { iRows.push([id, razorpay[id], genDate(r)]); });
  shiftIds.forEach(function(id) { iRows.push([id, razorpay[id], genDate(r)]); });

  write('04-mixed', { razorpay: rRows, bank: bRows, internal: iRows });
})();

// 5. No matches
(function() {
  var r = rng(321);
  var mk = function(p) { return genIds(25, p, r).map(function(id) { return [id, genAmount(r), genDate(r)]; }); };
  write('05-no-matches', { razorpay: mk('R'), bank: mk('B'), internal: mk('I') });
})();

// 6. Large (200 per source)
(function() {
  var r = rng(654);
  var ids = genIds(200, 'TXN', r);
  var mk = function() { return ids.map(function(id) { return [id, genAmount(r, 100, 100000), genDate(r)]; }); };
  write('06-large', { razorpay: mk(), bank: mk(), internal: mk() });
})();

// 7. Edge amounts
(function() {
  var r = rng(111);
  var amounts = [0.01, 1, 10, 100, 999.99, 1000, 5000, 10000, 50000, 999999.99];
  var ids = amounts.map(function(_, i) { return 'EDGE' + String(i + 1).padStart(3, '0'); });
  var mk = function() { return ids.map(function(id, i) { return [id, amounts[i], genDate(r, i)]; }); };
  write('07-edge-amounts', { razorpay: mk(), bank: mk(), internal: mk() });
})();

// 8. Stress test (duplicates within source)
(function() {
  var r = rng(222);
  var ids = genIds(30, 'STR', r);
  var dupIds = ids.slice(0, 10);
  var mk = function() {
    var rows = ids.map(function(id) { return [id, genAmount(r), genDate(r)]; });
    dupIds.forEach(function(id) { rows.push([id, genAmount(r), genDate(r)]); });
    return rows;
  };
  write('08-with-duplicates', { razorpay: mk(), bank: mk(), internal: mk() });
})();

console.log('\nDone! 8 sample scenarios created in public/data/samples/');
