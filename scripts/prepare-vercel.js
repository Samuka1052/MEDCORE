const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const publicDirectory = path.join(projectRoot, 'public');
const assets = [
  'index.html',
  'app.js',
  'styles.css',
  'reset-password.html',
  'reset-password.js',
  'MEDCORE_Logo_horizontal_azul-semfundo.png'
];

fs.mkdirSync(publicDirectory, { recursive: true });

for (const asset of assets) {
  fs.copyFileSync(path.join(projectRoot, asset), path.join(publicDirectory, asset));
}
