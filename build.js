// build.js — zero-deps
// Expande includes dos HTML em src/ e gera dist/

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');
const PARTIALS_DIR = path.join(SRC, '_partials');

async function rimraf(dir) {
  if (fs.existsSync(dir)) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    await Promise.all(entries.map(entry => {
      const p = path.join(dir, entry.name);
      return entry.isDirectory() ? rimraf(p) : fsp.unlink(p);
    }));
    await fsp.rmdir(dir);
  }
}

async function mkdirp(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function withHtmlExt(p) {
  return path.extname(p) ? p : `${p}.html`;
}

function resolveIncludePath(baseDir, raw) {
  // remove comentários/espacos
  let inc = raw.trim();

  // se veio só 'head.html' ou 'header.html', procurar em _partials
  if (!inc.includes('/') && !inc.startsWith('_partials')) {
    inc = path.join(PARTIALS_DIR, withHtmlExt(inc));
  } else {
    // normalizar relativo ao SRC se vier com _partials/...
    if (inc.startsWith('_partials')) {
      inc = path.join(SRC, withHtmlExt(inc));
    } else {
      // caminho relativo ao arquivo base
      inc = path.join(baseDir, withHtmlExt(inc));
    }
  }

  return path.normalize(inc);
}

function expandIncludesOnce(html, fileDir, warnings) {
  // Suporta:
  // 1) @@include("caminho")
  // 2) <!-- @@include caminho -->
  // 3) <!-- @include "caminho" -->
  const patterns = [
    // @@include("...") ou @@include('...')
    /@@include\(\s*["']?\s*([^"')\s]+)\s*["']?\s*\)/g,
    // <!-- @@include caminho -->
    /<!--\s*@@include\s+["']?\s*([^"'>\s]+)\s*["']?\s*-->/g,
    // <!-- @include "caminho" -->
    /<!--\s*@include\s+["']?\s*([^"'>\s]+)\s*["']?\s*-->/g,
  ];

  let changed = false;

  for (const rx of patterns) {
    html = html.replace(rx, (m, p1) => {
      try {
        const incPath = resolveIncludePath(fileDir, p1);
        if (!fs.existsSync(incPath)) {
          warnings.push(`WARN: include não encontrado: ${p1} (resolvido: ${incPath})`);
          return `<!-- include NÃO encontrado: ${p1} -->`;
        }
        const incContent = fs.readFileSync(incPath, 'utf8');
        changed = true;
        return incContent;
      } catch (e) {
        warnings.push(`WARN: falha ao incluir ${p1}: ${e.message}`);
        return `<!-- erro ao incluir: ${p1} -->`;
      }
    });
  }

  return { html, changed };
}

function expandIncludesAll(html, fileDir, warnings) {
  // Faz múltiplas passagens até não restar includes
  let pass = 0;
  while (pass < 10) {
    const { html: out, changed } = expandIncludesOnce(html, fileDir, warnings);
    html = out;
    if (!changed) break;
    pass++;
  }
  return html;
}

async function collectHtmlFiles(dir) {
  const out = [];
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (p === PARTIALS_DIR) continue; // não builda parciais
      out.push(...await collectHtmlFiles(p));
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.html')) {
      out.push(p);
    }
  }
  return out;
}

async function copyIfExists(from, to) {
  if (!fs.existsSync(from)) return false;
  const stat = await fsp.stat(from);
  if (stat.isDirectory()) {
    await mkdirp(to);
    const entries = await fsp.readdir(from, { withFileTypes: true });
    for (const ent of entries) {
      await copyIfExists(path.join(from, ent.name), path.join(to, ent.name));
    }
  } else {
    await mkdirp(path.dirname(to));
    await fsp.copyFile(from, to);
  }
  return true;
}

(async function build() {
  const t0 = Date.now();
  const warnings = [];

  // 1) limpar e recriar dist
  await rimraf(DIST);
  await mkdirp(DIST);

  // 2) processar todos os HTML de src (menos _partials)
  const htmlFiles = await collectHtmlFiles(SRC);

  for (const abs of htmlFiles) {
    const relFromSrc = path.relative(SRC, abs); // ex: "tudo.html" ou "sub/arquivo.html"
    const outPath = path.join(DIST, relFromSrc);
    const outDir = path.dirname(outPath);
    await mkdirp(outDir);

    const raw = await fsp.readFile(abs, 'utf8');
    const fileDir = path.dirname(abs);

    const finalHtml = expandIncludesAll(raw, fileDir, warnings);
    await fsp.writeFile(outPath, finalHtml, 'utf8');
    console.log(`✓ HTML: ${relFromSrc}`);
  }

  // 3) copiar estáticos
  const copied = [];
  if (await copyIfExists(path.join(__dirname, 'assets'), path.join(DIST, 'assets'))) copied.push('assets/');
  if (await copyIfExists(path.join(__dirname, 'manifest.webmanifest'), path.join(DIST, 'manifest.webmanifest'))) copied.push('manifest.webmanifest');
  if (await copyIfExists(path.join(__dirname, 'sw.js'), path.join(DIST, 'sw.js'))) copied.push('sw.js');

  copied.forEach(x => console.log(`✓ Copiado: ${x}`));

  // 4) avisos
  if (warnings.length) {
    console.log('\n--- AVISOS ---');
    warnings.forEach(w => console.warn(w));
  }

  console.log(`\nBuild concluído em ${((Date.now() - t0) / 1000).toFixed(2)}s. Saída em dist/.`);
})().catch(err => {
  console.error('ERRO no build:', err);
  process.exit(1);
});
