const fs = require('fs');
const path = require('path');

const srcFile = path.join(__dirname, 'src', 'app.js');
const destFile = path.join(__dirname, 'public', 'app.js');

let content = fs.readFileSync(srcFile, 'utf-8');

const apiUrl = process.env.PUBLIC_API_URL || 'http://127.0.0.1:8080';
const apiToken = process.env.PUBLIC_API_TOKEN || 'kiwi_secret_token_dev';

// Replace the URLs and tokens to completely hardcode them
content = content.replace(
  "let serverUrl = localStorage.getItem(STORAGE_KEY_URL) || window.location.origin;",
  `let serverUrl = '${apiUrl}';`
);
content = content.replace(
  "let apiToken = localStorage.getItem(STORAGE_KEY_TOKEN) || DEFAULT_DEV_TOKEN;",
  `let apiToken = '${apiToken}';`
);

fs.writeFileSync(destFile, content);
console.log('Built app.js with API URL:', apiUrl);
