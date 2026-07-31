async function testRoutes() {
  const routes = ['bnn', 'score', 'marketcall-status', 'ingest'];
  for (const r of routes) {
    const res = await fetch(`https://roguecfa.vercel.app/api/${r}`);
    console.log(`api/${r} -> ${res.status} ${res.statusText}`);
  }
}

testRoutes();
