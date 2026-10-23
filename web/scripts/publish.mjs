// Copia el export estatico (out/) a la raiz del repositorio para que
// GitHub Pages lo sirva en https://axelrodriguez52.github.io/mapview-app/
import fs from 'node:fs';
import path from 'node:path';

const webDir = path.resolve(import.meta.dirname, '..');
const outDir = path.join(webDir, 'out');
const repoRoot = path.resolve(webDir, '..');

if (!fs.existsSync(outDir)) {
  console.error('No existe web/out. Ejecuta primero: npm run build');
  process.exit(1);
}

// Limpiar builds previos
for (const target of ['_next', '404.html']) {
  fs.rmSync(path.join(repoRoot, target), { recursive: true, force: true });
}

fs.cpSync(outDir, repoRoot, { recursive: true, force: true });

// Lista completa de assets para que el service worker pueda precachear
// tambien los chunks dinamicos, no solo los que aparecen en el HTML.
const basePath = '/mapview-app';
const staticDir = path.join(outDir, '_next', 'static');
const assets = [];
function collectAssets(dir, rel = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectAssets(full, nextRel);
    else assets.push(`${basePath}/_next/static/${nextRel}`);
  }
}
if (fs.existsSync(staticDir)) collectAssets(staticDir);

const manifest = JSON.stringify({ assets }, null, 2) + '\n';
fs.writeFileSync(path.join(repoRoot, 'asset-manifest.json'), manifest);
fs.writeFileSync(path.join(outDir, 'asset-manifest.json'), manifest);

console.log(`Publicado en la raiz del repo: ${repoRoot} (${assets.length} assets)`);
