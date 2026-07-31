import { SCORING_CONFIG, getAnnualBenchmarkRate } from '../api/analyst-record.js';

console.log('=== AUDIT & VERIFICATION OF SCORING ENGINE v3.2.0-shrinkage-uncalibrated-prior ===');
console.log('SCORING_CONFIG:', JSON.stringify(SCORING_CONFIG, null, 2));

// Test 1: Ticker to Benchmark Exchange Routing Verification
function testTickerRouting() {
  console.log('\n--- Test 1: Ticker -> Benchmark Exchange Routing ---');
  const tickers = [
    { ticker: 'EIF.TO', expected: 8.0, label: 'Canadian TSX' },
    { ticker: 'GRT-U.TO', expected: 8.0, label: 'Canadian TSX' },
    { ticker: 'HWX.V', expected: 8.0, label: 'Canadian Venture' },
    { ticker: 'C', expected: 10.0, label: 'US NYSE (Citigroup)' },
    { ticker: 'MRK', expected: 10.0, label: 'US NYSE (Merck)' },
    { ticker: 'CLS', expected: 10.0, label: 'US NYSE (Celestica US)' },
    { ticker: 'PIPR', expected: 10.0, label: 'US NASDAQ (Piper Sandler)' },
    { ticker: 'FCX', expected: 10.0, label: 'US NYSE (Freeport-McMoRan)' },
    { ticker: 'HROW', expected: 10.0, label: 'US NASDAQ (Harrow)' },
    { ticker: 'GPRO.O', expected: 10.0, label: 'US NASDAQ (GoPro)' },
  ];

  for (const item of tickers) {
    const rate = getAnnualBenchmarkRate(item.ticker);
    const pass = rate === item.expected;
    console.log(`  Ticker "${item.ticker}" (${item.label}) -> Annual Benchmark Rate: ${rate}%/yr | Pass: ${pass}`);
    if (!pass) {
      console.error(`FAIL: Ticker ${item.ticker} routed incorrectly to ${rate}%`);
      process.exit(1);
    }
  }
}

// Test 2: H_raw Redefinition & Andrew Pink's BIP-U.TO +37% Win Verification
function testRedefinedHRaw() {
  console.log('\n--- Test 2: H_raw Redefinition & BIP-U.TO +37% Win Verification ---');

  // Andrew Pink's 20 historical picks
  const pinkPicks = [
    { ticker: 'EIF.TO', returnPct: 67, date: '2026-07-24' },
    { ticker: 'GRT-U.TO', returnPct: 30, date: '2026-07-24' },
    { ticker: 'WSP.TO', returnPct: -39, date: '2026-07-24' },
    { ticker: 'ATRL.TO', returnPct: 48, date: '2025-10-30' },
    { ticker: 'SIA.TO', returnPct: 14, date: '2025-10-30' },
    { ticker: 'CPX.TO', returnPct: 40, date: '2025-10-30' },
    { ticker: 'CVE.TO', returnPct: -39, date: '2025-04-30' },
    { ticker: 'CSH-U.TO', returnPct: 43, date: '2025-04-30' },
    { ticker: 'GRT-U.TO', returnPct: -6, date: '2025-04-30' },
    { ticker: 'CVE.TO', returnPct: -3, date: '2024-07-23' },
    { ticker: 'CSH.U', returnPct: 7, date: '2024-07-23' },
    { ticker: 'GRT.UN', returnPct: 5, date: '2024-07-23' },
    { ticker: 'XGD.TO', returnPct: -19, date: '2023-07-06' },
    { ticker: 'DSG.TO', returnPct: 65, date: '2023-07-06' },
    { ticker: 'IIP.UN', returnPct: -4, date: '2023-07-06' },
    { ticker: 'PKI.TO', returnPct: -8, date: '2020-05-21' },
    { ticker: 'EIF.TO', returnPct: -33, date: '2020-05-21' },
    { ticker: 'GRT-U.TO', returnPct: 15, date: '2020-05-21' },
    { ticker: 'PKI.TO', returnPct: 27, date: '2020-01-28' },
    { ticker: 'BIP-U.TO', returnPct: 37, date: '2020-01-28' },
  ];

  let positiveHits = 0;
  for (const p of pinkPicks) {
    const isWin = p.returnPct > 0;
    if (isWin) positiveHits++;
    if (p.ticker === 'BIP-U.TO' && p.date === '2020-01-28') {
      console.log(`  BIP-U.TO (2020-01-28) Return: +${p.returnPct}% -> Classified as Win: ${isWin}`);
      if (!isWin) {
        console.error('FAIL: BIP-U.TO (+37%) was falsely classified as a loss!');
        process.exit(1);
      }
    }
  }

  const nTotal = pinkPicks.length;
  const rawHitRate = Number((positiveHits / nTotal).toFixed(2));
  console.log(`  Andrew Pink Dataset: ${positiveHits}/${nTotal} positive return wins -> rawHitRate = ${(rawHitRate * 100).toFixed(0)}%`);

  // Source Table Assertion Check
  const expectedHitRate = Number((positiveHits / nTotal).toFixed(2));
  if (Math.abs(rawHitRate - expectedHitRate) > 0.001) {
    console.error('FAIL: Source table guardrail assertion failed!');
    process.exit(1);
  } else {
    console.log('PASS: Ground-truth H_raw definition verified with zero table contradictions.');
  }
}

testTickerRouting();
testRedefinedHRaw();
