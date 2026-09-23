const fs = require('fs');
const path = require('path');

const srcFile = path.join(__dirname, 'src', 'app.js');
const destFile = path.join(__dirname, 'public', 'app.js');

let content = fs.readFileSync(srcFile, 'utf-8');

const apiUrl = process.env.PUBLIC_API_URL || 'http://127.0.0.1:8080';

// Replace the fallback origin with the API URL
content = content.replace(
  "let serverUrl = localStorage.getItem(STORAGE_KEY_URL) || window.location.origin;",
  `let serverUrl = localStorage.getItem(STORAGE_KEY_URL) || '${apiUrl}';`
);

fs.writeFileSync(destFile, content);
console.log('Built app.js with API URL:', apiUrl);
