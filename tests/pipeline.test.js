import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeDigestResult, CANONICAL_TICKER_MAP, CANONICAL_REVERSE_TICKER_MAP } from '../api/_pipeline.js';

test('sanitizeDigestResult collapses 4-entry Cogeco payload (CCI/CJR/CJR.B/CGO) to 1 CCA entry', () => {
  const payload = {
    picks: [
      { ticker: 'CCI', company: 'Cogeco', reasoning: 'First mention of Cogeco.' },
      { ticker: 'CJR.B', company: 'Cogeco Communications', reasoning: 'Second mention of Cogeco.' },
      { ticker: 'CGO', company: 'Kojiko', reasoning: 'Phonetic ASR mention.' },
      { ticker: 'CCA', company: 'Cogeco Communications Inc', reasoning: 'Official ticker mention.' },
    ],
  };

  const result = sanitizeDigestResult(payload);

  assert.equal(result.picks.length, 1, 'Should collapse all 4 variants to exactly 1 pick');
  assert.equal(result.picks[0].ticker, 'CCA', 'Ticker must be CCA');
  assert.equal(result.picks[0].company, 'Cogeco Communications', 'Company must be Cogeco Communications');
  assert.ok(result.picks[0].reasoning.includes('First mention'), 'Reasoning should merge entries');
  assert.ok(result.picks[0].reasoning.includes('Official ticker'), 'Reasoning should merge entries');
});

test('sanitizeDigestResult collapses 2-entry Cogeco payload (CCA + Cogeco Inc. (Videotron/Cable subsidiary)/CCI) to 1 CCA entry', () => {
  const payload = {
    callerMentions: [
      {
        ticker: 'CCA',
        company: 'Cogeco Communications',
        reasoning: 'Gardner avoids Cogeco pending proof of US turnaround.',
        stance: 'hold',
      },
      {
        ticker: 'CCI',
        company: 'Cogeco Inc. (Videotron/Cable subsidiary)',
        reasoning: 'Gardner prefers Quebecor over Cogeco.',
        stance: 'hold',
      },
    ],
  };

  const result = sanitizeDigestResult(payload);

  assert.equal(result.callerMentions.length, 1, 'Should collapse 2-entry Cogeco payload to exactly 1 entry');
  assert.equal(result.callerMentions[0].ticker, 'CCA', 'Ticker must be normalized to CCA');
  assert.equal(result.callerMentions[0].company, 'Cogeco Communications', 'Parenthetical details stripped and company normalized');
});

test('sanitizeDigestResult corrects hallucinated ticker EFP to EFN for Element Fleet Management', () => {
  const payload = {
    picks: [
      {
        ticker: 'EFP',
        company: 'Element Fleet Management',
        reasoning: 'Strong fleet leasing growth.',
        stance: 'buy',
      },
    ],
  };

  const result = sanitizeDigestResult(payload);

  assert.equal(result.picks.length, 1);
  assert.equal(result.picks[0].ticker, 'EFN', 'EFP must be corrected to EFN');
  assert.equal(result.picks[0].company, 'Element Fleet Management');
});

test('sanitizeDigestResult populates digest._warnings and logs warning when transcript has Past Picks markers but pastPicks is empty', () => {
  const payload = {
    picks: [{ ticker: 'TD', company: 'Toronto-Dominion Bank', reasoning: 'Banking thesis.' }],
    pastPicks: [],
  };

  const transcript = 'Welcome back to Market Call. Looking back at your past picks from 6 months ago... We did sell Abbott Labs.';

  let warningLogged = false;
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (args.join(' ').includes('WARNING: Transcript text contains Past Picks review markers')) {
      warningLogged = true;
    }
    originalWarn(...args);
  };

  let result;
  try {
    result = sanitizeDigestResult(payload, transcript);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(warningLogged, true, 'Console warning should be logged for empty pastPicks');
  assert.ok(Array.isArray(result._warnings), '_warnings array must exist');
  assert.equal(result._warnings.length, 1, '_warnings should contain 1 warning entry');
  assert.ok(result._warnings[0].includes('pastPicks is empty'), '_warnings entry should describe pastPicks degradation');
});

test('word-boundary fuzzy matching prevents substring collisions on generic company names', () => {
  const payload = {
    picks: [
      {
        ticker: 'XYZ',
        company: 'LADYBIRD INC', // Contains "BIRD" as substring, but is NOT "BIRD CONSTRUCTION"
        reasoning: 'Unrelated company testing boundary match.',
      },
    ],
  };

  const result = sanitizeDigestResult(payload);

  assert.equal(result.picks[0].ticker, 'XYZ', 'Should not match BDT for LADYBIRD');
  assert.equal(result.picks[0].company, 'LADYBIRD INC', 'No false positive canonical match for LADYBIRD');
});
