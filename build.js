// build.js — build zero-dependências
// - Expande <!-- @include arquivo.html -->
// - Copia assets/ e arquivos soltos (manifest, sw, robots, sitemap)
// - Gera dist/ limpo

const fs = require("fs");
const path = require("path");

// Helpers
const r = (...p) => path.join(process.cwd(), ...p);
const exists = (p) => fs.existsSync(p);
const read = (p) => fs.readFileSync(p, "utf8");
const write = (p, c) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, c);
};
const copyFile = (src, dst) => {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
};
const copyDir = (src, dst) => {
  if (!exists(src)) return;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      copyFile(from, to);
    }
  }
};

// Limpar dist
const distDir = r("dist");
if (exists(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);

// Expandir includes
// Procura *.html em src/
const srcDir = r("src");
if (!exists(srcDir)) {
  console.error('Pasta "src" não encontrada. Crie "src/" e coloque seus HTML lá.');
  process.exit(1);
}

const partialsDir = r("src", "_partials");
const includeRE = /<!--\s*@include\s+([^\s]+)\s*-->/g;

function expandIncludes(html) {
  return html.replace(includeRE, (_, includeFile) => {
    const p1 = r("src", "_partials", includeFile);
    const p2 = r("src", includeFile);
    const inc = exists(p1) ? p1 : p2;
    if (!exists(inc)) {
      console.warn(`(aviso) include não encontrado: ${includeFile}`);
      return `<!-- include NAO ENCONTRADO: ${includeFile} -->`;
    }
    return read(inc);
  });
}

// Processar todos .html (nível raiz de src/)
for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
    const inFile = path.join(srcDir, entry.name);
    const outFile = path.join(distDir, entry.name);
    const html = read(inFile);
    const expanded = expandIncludes(html);
    write(outFile, expanded);
    console.log("✓ HTML:", entry.name);
  }
}

// Copiar assets/
if (exists(r("assets"))) {
  copyDir(r("assets"), r("dist", "assets"));
  console.log("✓ Copiado: assets/");
}

// Copiar arquivos soltos úteis
[
  "manifest.webmanifest",
  "sw.js",
  "robots.txt",
  "sitemap.xml",
  "CNAME" // se usar domínio próprio no GitHub Pages
].forEach((file) => {
  if (exists(r(file))) {
    copyFile(r(file), r("dist", file));
    console.log("✓ Copiado:", file);
  }
});

console.log("\nBuild concluído. Saída em dist/.");
