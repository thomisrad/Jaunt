// Copies the website files into www/, which is what the Android app bundles.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const file of ['index.html', 'style.css', 'script.js']) {
  fs.copyFileSync(path.join(root, file), path.join(out, file));
}
console.log('Copied website files into www/');
