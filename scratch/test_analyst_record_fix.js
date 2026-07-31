import fs from 'fs';

let envPath = '.env.local';
if (!fs.existsSync(envPath)) envPath = '.env';
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      process.env[key] = val;
    }
  }
}

async function testAnalystRecordFix() {
  console.log('=== TESTING ANALYST RECORD API HANDLER LOCAL FIX ===');
  const handler = (await import('../api/analyst-record.js')).default;

  const req = {
    method: 'GET',
    query: { guest: 'Tim Regan' },
    headers: {},
  };

  const res = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(data) {
      console.log(`[HTTP ${this.statusCode}] Response Data:`);
      console.log(JSON.stringify(data, null, 2).slice(0, 1500));
      return this;
    },
  };

  try {
    await handler(req, res);
  } catch (e) {
    console.error('API Crash Error:', e);
  }
}

testAnalystRecordFix();
