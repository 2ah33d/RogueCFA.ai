import fs from 'fs';

async function searchJasperConfigQuery() {
  const url = 'https://lib.jasperplayer.com/18.0.1/jasper.umd.production.min.js';
  const res = await fetch(url);
  const text = await res.text();

  const idx = text.indexOf('config.jasperplayer.com');
  if (idx !== -1) {
    console.log('Snippet around config.jasperplayer.com:');
    console.log(text.slice(idx - 100, idx + 300));
  } else {
    console.log('Not found');
  }
}

searchJasperConfigQuery();
