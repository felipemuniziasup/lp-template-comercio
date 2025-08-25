// assets/js/catalog-hibrido.js
// Módulo híbrido: junta produtos locais + planilha e renderiza no #gridProdutos
import { produtosLocais } from "./produtos.js";

/* ==========================
   Helpers utilitários
   ========================== */

/** CSV parser simples com suporte a campos entre aspas ("," dentro do campo) */
function parseCSV(csvText) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { // aspas escapadas
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\r") {
        // ignora CR
      } else if (ch === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += ch;
      }
    }
  }
  // última célula / linha
  if (cell.length || inQuotes || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Converte "2.199,90" / "2199,90" / "2199" em Number */
function parsePrecoBR(v) {
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  // remove espaços e R$
  s = s.replace(/[R$\s]/g, "");
  // se tiver vírgula decimal, troca por ponto; remove separador de milhar
  // casos: "2.199,90" -> "2199.90" | "2199,90" -> "2199.90" | "2,199.90" (raro) -> "2199.90"
  if (s.indexOf(",") > -1 && s.lastIndexOf(",") > s.lastIndexOf(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Verdadeiro para "1", "true", "sim", "yes" (case-insensitive) */
function parseBool(v) {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "sim" || s === "yes";
}

/** Formata moeda BR (apenas para exibição) */
function fmtBR(n) {
  try {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
  } catch {
    return `R$ ${n.toFixed(2)}`;
  }
}

/* ==========================
   Planilha (CSV do Google)
   ========================== */

async function carregarPlanilhaCSV(url) {
  if (!url || url.includes("SEU_ID")) return []; // não configurado ainda
  try {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`Falha ao buscar planilha (${resp.status})`);
    const texto = await resp.text();
    const linhas = parseCSV(texto);
    if (!linhas.length) return [];

    const cabecalho = linhas.shift().map(h => (h || "").trim());
    const idx = Object.fromEntries(cabecalho.map((h, i) => [h.toLowerCase(), i]));

    const read = (l, nome) => {
      const i = idx[nome.toLowerCase()];
      return i == null ? "" : (l[i] || "").trim();
    };

    const out = linhas
      .filter(l => l.some(c => String(c).trim() !== "")) // ignora linhas vazias
      .map(l => {
        const nome = read(l, "nome") || read(l, "produto") || read(l, "titulo");
        const preco = parsePrecoBR(read(l, "preco") || read(l, "preço"));
        const precoDe = parsePrecoBR(read(l, "precoDe") || read(l, "preçoDe") || read(l, "de"));
        const marca = (read(l, "marca") || read(l, "brand") || "").toLowerCase();
        const imagem = read(l, "imagem") || read(l, "image") || "";
        const descricao = read(l, "descricao") || read(l, "descrição") || read(l, "desc") || "";
        const novo = read(l, "novo") || read(l, "new") || read(l, "data") || "2000-01-01";

        const featured = parseBool(read(l, "featured") || read(l, "destaque") || read(l, "destaques"));
        const promo = parseBool(read(l, "promo") || read(l, "promoção") || read(l, "promocao"));

        return {
          nome,
          preco,
          precoDe,
          marca: marca || "outros",
          imagem,
          descricao,
          novo,
          featured,
          promo,
        };
      });

    return out;
  } catch (e) {
    console.warn("⚠️ Erro ao carregar planilha:", e.message);
    return [];
  }
}

/* ==========================
   Renderização
   ========================== */

function criarCard(prod) {
  const article = document.createElement("article");
  article.className = "offer-card rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden";
  article.setAttribute("data-brand", prod.marca || "outros");
  article.setAttribute("data-price", String(prod.preco || 0));
  article.setAttribute("data-new", prod.novo || "2000-01-01");
  article.setAttribute("data-search", `${prod.nome || ""} ${prod.descricao || ""}`.toLowerCase());
  if (prod.featured) article.setAttribute("data-featured", "1");
  if (prod.promo) article.setAttribute("data-promo", "1");

  const precoDeHtml = prod.precoDe > 0 ? `<div class="price-strike text-xs">${fmtBR(prod.precoDe)}</div>` : "";

  article.innerHTML = `
    <img src="${prod.imagem || "assets/celulares/fallback-celular.jpg"}" alt="${prod.nome || "Produto"}"
         class="w-full h-52 object-cover"
         loading="lazy" decoding="async"
         onerror="this.onerror=null;this.src='assets/celulares/fallback-celular.jpg'">
    <div class="p-5">
      <h2 class="font-bold text-lg">${prod.nome || "Produto"}</h2>
      <p class="text-sm text-slate-600">${prod.descricao || ""}</p>
      <div class="mt-3">
        ${precoDeHtml}
        <div class="text-xl font-extrabold text-blue-700">${fmtBR(prod.preco || 0)}</div>
      </div>
      <a class="btn-wa mt-4 w-full" data-wa-product="${(prod.nome || "Produto")
        .replace(/"/g, "&quot;")}">Falar no WhatsApp</a>
    </div>
  `;
  return article;
}

function renderizarProdutosNoGrid(lista) {
  const grid = document.getElementById("gridProdutos");
  const countEl = document.getElementById("countVisible");
  const empty = document.getElementById("emptyState");
  if (!grid) return;

  if (!Array.isArray(lista)) lista = [];

  // Só substitui os cards mock se houver conteúdo para renderizar;
  // se vier vazio (planilha off), mantemos o HTML já presente.
  if (lista.length > 0) {
    grid.innerHTML = "";
    lista.forEach(prod => grid.appendChild(criarCard(prod)));
  }

  const total = lista.length > 0 ? lista.length : grid.querySelectorAll("article.offer-card").length;
  if (countEl) countEl.textContent = String(total);
  if (empty) empty.classList.toggle("hidden", total > 0);

  // Deixa o MutationObserver do filtro detectar a troca.
}

/* ==========================
   Público (API global)
   ========================== */

async function renderCatalogSimple({ pageLabel = "Catálogo", categoria = "", planilhaUrl = "" } = {}) {
  // 1) carrega planilha (se houver) e normaliza produtos locais
  const daPlanilha = await carregarPlanilhaCSV(planilhaUrl);
  const locaisNorm = (Array.isArray(produtosLocais) ? produtosLocais : []).map(p => ({
    nome: p.nome || p.titulo || "Produto",
    preco: parsePrecoBR(p.preco ?? p.price ?? 0),
    precoDe: parsePrecoBR(p.precoDe ?? p.de ?? 0),
    marca: (p.marca || p.brand || "outros").toLowerCase(),
    imagem: p.imagem || p.image || "",
    descricao: p.descricao || p.desc || "",
    novo: p.novo || p.data || "2000-01-01",
    featured: !!(p.featured || p.destaque),
    promo: !!(p.promo || p.promocao || p.promoção),
  }));

  // 2) mistura e renderiza
  const todos = [...locaisNorm, ...daPlanilha];
  renderizarProdutosNoGrid(todos);
}

// expõe no escopo global para ser usado pelo seu HTML já existente
window.NandoCatalog = window.NandoCatalog || {};
window.NandoCatalog.renderCatalogSimple = renderCatalogSimple;
