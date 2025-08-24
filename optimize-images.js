// optimize-images.js (ESM)
// Otimiza JPG/PNG e gera WEBP dentro de dist/ preservando estrutura
// Uso: npm run build && npm run optimize:images

import fs from "fs";
import path from "path";
import imagemin from "imagemin";
import imageminWebp from "imagemin-webp";
import imageminMozjpeg from "imagemin-mozjpeg";
import imageminPngquant from "imagemin-pngquant";
import { fileURLToPath } from "url";

// __dirname em ESM:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fsp = fs.promises;
const DIST_DIR = path.join(__dirname, "dist");

// Config de qualidade
const QUALITY = {
  jpg: 78,         // mozjpeg quality (0–100)
  pngMin: 0.6,     // pngquant (0–1)
  pngMax: 0.8,
  webpFromJpg: 80, // webp quality (0–100)
  webpFromPng: 82,
};

// Helpers -------------------------------------------------------------
async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function listFilesRec(root) {
  const out = [];
  async function walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else {
        out.push(full);
      }
    }
  }
  await walk(root);
  return out;
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function rel(p) {
  return path.relative(DIST_DIR, p).split(path.sep).join("/");
}

// Pipeline por arquivo ------------------------------------------------
async function optimizeJpgPng(file) {
  const ext = path.extname(file).toLowerCase();
  if (![".jpg", ".jpeg", ".png"].includes(ext)) return null;

  const bufIn = await fsp.readFile(file);
  const sizeIn = bufIn.length;

  // 1) Recomprime original (só substitui se ficar 1% menor)
  let optimized;
  try {
    if (ext === ".jpg" || ext === ".jpeg") {
      optimized = await imagemin.buffer(bufIn, {
        plugins: [imageminMozjpeg({ quality: QUALITY.jpg, progressive: true })],
      });
    } else {
      optimized = await imagemin.buffer(bufIn, {
        plugins: [imageminPngquant({ quality: [QUALITY.pngMin, QUALITY.pngMax], strip: true })],
      });
    }
  } catch (e) {
    console.warn(`! Falha ao otimizar ${rel(file)}:`, e.message);
    optimized = null;
  }

  let savedOriginal = false;
  if (optimized && optimized.length > 0 && optimized.length < sizeIn * 0.99) {
    await fsp.writeFile(file, optimized);
    savedOriginal = true;
  }

  // 2) Gera WEBP ao lado
  const webpTarget = file.replace(/\.(jpe?g|png)$/i, ".webp");
  try {
    const webpBuf = await imagemin.buffer(savedOriginal ? optimized : bufIn, {
      plugins: [
        imageminWebp({
          quality: ext === ".png" ? QUALITY.webpFromPng : QUALITY.webpFromJpg,
        }),
      ],
    });
    await fsp.writeFile(webpTarget, webpBuf);
  } catch (e) {
    console.warn(`! Falha ao gerar WEBP para ${rel(file)}:`, e.message);
  }

  return {
    file,
    before: sizeIn,
    after: savedOriginal ? (optimized ? optimized.length : sizeIn) : sizeIn,
    webp: webpTarget,
  };
}

// Execução ------------------------------------------------------------
(async function main() {
  const t0 = Date.now();

  try {
    const stat = await fsp.stat(DIST_DIR);
    if (!stat.isDirectory()) {
      console.error("✖ dist/ não é diretório. Rode antes: npm run build");
      process.exit(1);
    }
  } catch {
    console.error("✖ Pasta dist/ não encontrada. Rode antes: npm run build");
    process.exit(1);
  }

  console.log("🔎 Varredura de imagens em dist/ ...");
  const all = await listFilesRec(DIST_DIR);
  const candidates = all.filter((f) => /\.(jpe?g|png)$/i.test(f));

  if (candidates.length === 0) {
    console.log("ℹ️ Nenhuma JPG/PNG encontrada em dist/. Nada a fazer.");
    process.exit(0);
  }

  await ensureDir(DIST_DIR);

  let totalBefore = 0;
  let totalAfter = 0;
  let done = 0;

  for (const file of candidates) {
    const res = await optimizeJpgPng(file);
    if (res) {
      done++;
      totalBefore += res.before;
      totalAfter += res.after;
      const delta = res.before - res.after;
      const savedPct = ((delta / res.before) * 100).toFixed(1);
      console.log(
        `✔ ${rel(file)}  ${fmtBytes(res.before)} → ${fmtBytes(res.after)}  (−${fmtBytes(delta)} / ${savedPct}%);  +WEBP`
      );
    }
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(2);
  const deltaTotal = totalBefore - totalAfter;
  const pctTotal = totalBefore ? ((deltaTotal / totalBefore) * 100).toFixed(1) : "0.0";

  console.log("\n— Resumo —");
  console.log(`Arquivos processados: ${done}`);
  console.log(`Antes:  ${fmtBytes(totalBefore)}`);
  console.log(`Depois: ${fmtBytes(totalAfter)}  (economia ${fmtBytes(deltaTotal)} / ${pctTotal}%)`);
  console.log(`Tempo: ${dt}s`);
  console.log("\n🎯 Pronto! Imagens otimizadas e .webp gerados em dist/.");
})().catch((err) => {
  console.error("✖ Erro inesperado:", err);
  process.exit(1);
});
