#!/usr/bin/env node
/* =============================================================
   SpaceTwin · Verificador de links rotos (sin dependencias)
   Uso:  node scripts/check-links.js
   Revisa href/src relativos en los HTML y las rutas "*.html"
   que aparecen dentro de los scripts (js/*.js y <script> inline).
   ============================================================= */
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const htmls = fs.readdirSync(raiz).filter((f) => f.endsWith('.html'));
const jss = fs.readdirSync(path.join(raiz, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);

const errores = [];
let revisados = 0;

function comprobar(origen, ref) {
  if (!ref || /^(https?:|mailto:|tel:|data:|javascript:|#|\$\{)/i.test(ref)) return;
  const limpio = ref.split('#')[0].split('?')[0];
  if (!limpio || limpio.includes('${')) return;
  if (/^\//.test(limpio)) { errores.push(`${origen}: ruta absoluta "${ref}" (en GitHub Pages debe ser relativa)`); return; }
  revisados++;
  if (!fs.existsSync(path.join(raiz, decodeURI(limpio)))) errores.push(`${origen}: no existe "${ref}"`);
}

for (const f of htmls) {
  const s = fs.readFileSync(path.join(raiz, f), 'utf8');
  for (const m of s.matchAll(/\s(?:href|src)\s*=\s*"([^"]+)"/g)) comprobar(f, m[1]);
  for (const m of s.matchAll(/['"`]((?:\.\/)?[\w.-]+\.(?:html|JPG|jpg|png|js))(?:[?#][^'"`]*)?['"`]/g)) comprobar(f + ' (script)', m[1]);
}
for (const f of jss) {
  const s = fs.readFileSync(path.join(raiz, f), 'utf8');
  for (const m of s.matchAll(/['"`]((?:\.\/)?(?:sources\/)?[\w.-]+\.(?:html|JPG|jpg|png))(?:[?#][^'"`]*)?['"`]/g)) comprobar(f, m[1]);
}

if (errores.length) {
  console.error(`✗ ${errores.length} link(s) roto(s):`);
  errores.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}
console.log(`✓ ${revisados} referencias locales revisadas en ${htmls.length} HTML y ${jss.length} JS. Sin links rotos.`);
