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
console.log('Publicado en la raiz del repo:', repoRoot);
