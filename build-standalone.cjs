const fs = require('fs');

const original = fs.readFileSync('extension/media/index.html', 'utf8');
const standalone = original
  .replace(/API_PORT/g, '3737')
  .replace(/'nonce-CSP_NONCE'/g, "'unsafe-inline'")
  .replace(/nonce="CSP_NONCE"/g, '');

fs.writeFileSync('standalone-dashboard.html', standalone);
console.log('standalone-dashboard.html created.');
