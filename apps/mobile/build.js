const fs = require('fs');
const path = require('path');

const srcFile = path.join(__dirname, 'src', 'app.js');
const destFile = path.join(__dirname, 'public', 'app.js');

let content = fs.readFileSync(srcFile, 'utf-8');

const apiUrlStr = process.env.PUBLIC_API_URL ? `'${process.env.PUBLIC_API_URL}'` : 'window.location.origin';
const apiTokenStr = process.env.PUBLIC_API_TOKEN ? `'${process.env.PUBLIC_API_TOKEN}'` : `'kiwi_secret_token_dev'`;

// Replace the URLs and tokens 
content = content.replace(
  "let serverUrl = localStorage.getItem(STORAGE_KEY_URL) || window.location.origin;",
  `let serverUrl = ${apiUrlStr};`
);
content = content.replace(
  "let apiToken = localStorage.getItem(STORAGE_KEY_TOKEN) || DEFAULT_DEV_TOKEN;",
  `let apiToken = ${apiTokenStr};`
);

fs.writeFileSync(destFile, content);
console.log('Built app.js');
