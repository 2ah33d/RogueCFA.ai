import fs from 'fs';

async function findJasperEndpoints() {
  const url = 'https://lib.jasperplayer.com/18.0.1/jasper.umd.production.min.js';
  const res = await fetch(url);
  const text = await res.text();

  console.log('=== SEARCHING FOR API RESOLVERS IN JASPER PLAYER UMD ===');

  const matches = text.match(/https?:\/\/[a-z0-9\.\_\-]*jasperplayer[^\s"'`<>]+/gi) || [];
  console.log('Unique Jasper URLs found:', Array.from(new Set(matches)));

  const pathMatches = text.match(/\/content\/[a-z0-9\_\-\/]+/gi) || text.match(/\/v[0-9]\/[a-z0-9\_\-\/]+/gi) || [];
  console.log('Unique Path Templates found:', Array.from(new Set(pathMatches)).slice(0, 20));
}

findJasperEndpoints();
