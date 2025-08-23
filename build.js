// build.js - build sem dependências (includes + copiar assets + watch opcional)
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const SRC = path.resolve('src');
const DIST = path.resolve('dist');
const PARTIALS = path.join(SRC, '_partials');

function logOk(msg){ console.log('\x1b[32m%s\x1b[0m', msg); }
function logInfo(msg){ console.log(msg); }
function logErr(msg){ console.error('\x1b[31m%s\x1b[0m', msg); }

async function ensureDir(p){ await fsp.mkdir(p, { recursive: true }); }

async function copyRecursive(src, dest){
  const stat = await fsp.stat(src);
  if (stat.isDirectory()){
    await ensureDir(dest);
    const entries = await fsp.readdir(src);
    for (const e of entries){
      await copyRecursive(path.join(src, e), path.join(dest, e));
    }
  } else {
    await ensureDir(path.dirname(dest));
    await fsp.copyFile(src, dest);
  }
}

// Resolve caminhos de include:
// - se vier só "head.html", assume src/_partials/head.html
// - se vier "./_partials/head.html" ou "/_partials/head.html", normaliza.
function resolveIncludePath(raw){
  let p = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!p.includes('/')) p = `_partials/${p}`;
  if (p.startsWith('/')) p = p.slice(1);
  return path.join(SRC, p);
}

// Processa recursivamente <!-- @include ... -->
async function processIncludes(html, stack = new Set()){
  const rgx = /<!--\s*@include\s+([^\s]+)\s*-->/g;
  let out = '';
  let lastIndex = 0;
  let m;
  while ((m = rgx.exec(html)) !== null){
    out += html.slice(lastIndex, m.index);
    lastIndex = rgx.lastIndex;

    const incPath = resolveIncludePath(m[1]);
    if (stack.has(incPath)) {
      out += `<!-- include skipped (circular): ${incPath} -->`;
      continue;
    }
    try{
      const incContent = await fsp.readFile(incPath, 'utf8');
      stack.add(incPath);
      const rendered = await processIncludes(incContent, stack);
      stack.delete(incPath);
      out += rendered;
    } catch(e){
      out += `<!-- include not found: ${incPath} -->`;
    }
  }
  out += html.slice(lastIndex);
  // limpeza leve (opcional)
  out = out.replace(/\n{3,}/g, '\n\n');
  return out;
}

async function buildHtmlFile(file){
  const srcFile = path.join(SRC, file);
  const distFile = path.join(DIST, file);
  const raw = await fsp.readFile(srcFile, 'utf8');
  const rendered = await processIncludes(raw);
  await ensureDir(path.dirname(distFile));
  await fsp.writeFile(distFile, rendered, 'utf8');
  logOk(`✓ HTML: ${file}`);
}

async function buildAll(){
  // limpa dist
  await fsp.rm(DIST, { recursive: true, force: true });
  await ensureDir(DIST);

  // renderiza todos .html (exceto _partials)
  const entries = await fsp.readdir(SRC);
  const htmlFiles = entries.filter(f => f.endsWith('.html'));
  for (const f of htmlFiles) await buildHtmlFile(f);

  // copia assets + manifest + sw
  if (fs.existsSync('assets')) {
    await copyRecursive('assets', path.join(DIST, 'assets'));
    logOk('✓ Copiado: assets/');
  }
  for (const f of ['manifest.webmanifest', 'sw.js']){
    if (fs.existsSync(f)) {
      await copyRecursive(f, path.join(DIST, f));
      logOk(`✓ Copiado: ${f}`);
    }
  }
  logInfo('\nBuild concluído. Saída em dist/.');
}

async function watch(){
  logInfo('👀 Watch ligado. Qualquer alteração em src/ ou assets/ reconstrói.');
  const rebuild = async () => {
    try { await buildAll(); }
    catch (e){ logErr(e.message); }
  };
  await rebuild();

  const watchers = [];
  for (const dir of ['src', 'assets']){
    if (!fs.existsSync(dir)) continue;
    watchers.push(fs.watch(dir, { recursive: true }, (evt, filename) => {
      if (!filename) return;
      // debounce simples
      clearTimeout(watchers._t);
      watchers._t = setTimeout(rebuild, 120);
    }));
  }
}

if (process.argv.includes('--watch')) {
  watch();
} else {
  buildAll().catch(err => { logErr(err.message); process.exit(1); });
}
