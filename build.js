// build.js  (ESM)
// Build zero-deps: processa @@include de src/ para dist/ e copia assets/ + arquivos soltos

import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const SRC  = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');

async function rimraf(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {}
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyFile(src, dest) {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

async function copyDir(srcDir, destDir) {
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  await ensureDir(destDir);
  for (const e of entries) {
    const s = path.join(srcDir, e.name);
    const d = path.join(destDir, e.name);
    if (e.isDirectory()) {
      await copyDir(s, d);
    } else {
      await copyFile(s, d);
    }
  }
}

async function listHtmlAtRoot() {
  const entries = await fs.readdir(SRC, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && e.name.endsWith('.html'))
    .map(e => path.join(SRC, e.name));
}

// resolve @@include("...") ou @@include('...') ou @@include _partials/...
const includeRe = /@@include\((?:"|')([^"')]+)(?:"|')\)|@@include\(([^)]+)\)|@@include\s+([^\s>]+)\s*/g;

async function readFileUtf8(p) {
  return fs.readFile(p, 'utf8');
}

async function resolveInclude(baseDir, includePath, depth = 0) {
  if (depth > 10) throw new Error('Include muito profundo (possível loop).');
  const abs = path.isAbsolute(includePath)
    ? includePath
    : path.join(baseDir, includePath);
  let html = await readFileUtf8(abs);
  // Resolve includes aninhados
  html = await processIncludes(html, path.dirname(abs), depth + 1);
  return html;
}

async function processIncludes(content, baseDir, depth = 0) {
  const parts = [];
  let lastIdx = 0;
  for (const m of content.matchAll(includeRe)) {
    parts.push(content.slice(lastIdx, m.index));
    const raw = (m[1] || m[2] || m[3] || '').trim().replace(/^["']|["']$/g, '');
    const inc = await resolveInclude(baseDir, raw, depth);
    parts.push(inc);
    lastIdx = m.index + m[0].length;
  }
  parts.push(content.slice(lastIdx));
  return parts.join('');
}

async function buildHtmlFile(srcHtml) {
  const rel = path.relative(SRC, srcHtml);
  const out = path.join(DIST, rel);
  const raw = await readFileUtf8(srcHtml);
  const html = await processIncludes(raw, path.dirname(srcHtml));
  await ensureDir(path.dirname(out));
  await fs.writeFile(out, html, 'utf8');
  console.log(`✓ HTML: ${rel}`);
}

async function main() {
  // sanidade SRC
  if (!fssync.existsSync(SRC)) {
    console.error('✖ Pasta src/ não encontrada.');
    process.exit(1);
  }

  // limpa dist e recria
  await rimraf(DIST);
  await ensureDir(DIST);

  // processa HTML do root
  const htmls = await listHtmlAtRoot();
  for (const h of htmls) {
    await buildHtmlFile(h);
  }

  // copia assets/ se existir
  const assetsSrc = path.join(SRC, 'assets');
  if (fssync.existsSync(assetsSrc)) {
    await copyDir(assetsSrc, path.join(DIST, 'assets'));
    console.log('✓ Copiado: assets/');
  }

  // copia manifest.webmanifest e sw.js se existirem
  const extraFiles = ['manifest.webmanifest', 'sw.js'];
  for (const fname of extraFiles) {
    const s = path.join(SRC, fname);
    if (fssync.existsSync(s)) {
      await copyFile(s, path.join(DIST, fname));
      console.log(`✓ Copiado: ${fname}`);
    }
  }

  console.log('\nBuild concluído. Saída em dist/.');
}

main().catch(err => {
  console.error('✖ Erro no build:', err);
  process.exit(1);
});
