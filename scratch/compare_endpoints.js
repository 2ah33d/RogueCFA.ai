async function testStatus() {
  const statusRes = await fetch('https://roguecfa.vercel.app/api/marketcall-status');
  console.log('Status endpoint:', statusRes.status, statusRes.statusText);

  const ingestRes = await fetch('https://roguecfa.vercel.app/api/ingest');
  console.log('Ingest endpoint:', ingestRes.status, ingestRes.statusText);
}

testStatus();
