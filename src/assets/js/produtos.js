// ====================================================================
// produtos.js — NandoCatalog (dual-source: Planilha + Local)
// Lê a planilha (todas as colunas) e/ou um array local e renderiza o grid
// ====================================================================

(function () {
  // =========================
  // CONFIG
  // =========================
  // 1) Coloque aqui a URL do seu Google Apps Script (Web App) que retorna JSON
  //    Formato esperado: array de objetos com colunas:
  //    ID, Status, Categoria, Marca, Nome, Descricao, Preco, PrecoDe,
  //    Destaque, ImagemURL, LinkWA, CreatedAt, UpdateAt
  const SHEET_WEBAPP_URL = ""; // ex: "https://script.google.com/macros/s/AKfycbx.../exec"
  // Se estiver vazio, o catálogo será apenas local (se definido).

  // 2) Mapeamento de categorias aceitas (ajusta nomes se quiser)
  const CATEGORY_ALIASES = {
    celulares: ["celular", "celulares", "smartphone", "smartphones", "phone", "phones"],
    perfumes: ["perfume", "perfumes", "fragrancia", "fragrâncias", "fragrance", "parfum", "eau"],
    tudo: ["tudo", "catalogo", "catálogo", "todos", "all"],
  };

  // =========================
  // HELPERS
  // =========================
  const norm = (v) => (v == null ? "" : String(v).trim());
  const lower = (v) => norm(v).toLowerCase();
  const isTruthy = (v) => ["1", "true", "sim", "yes", "y"].includes(lower(v));
  const moneyToNumber = (txt) => {
    if (txt == null) return 0;
    const s = String(txt).replace(/[^\d,.\-]/g, "");
    // tenta "1.234,56" (BR) -> 1234.56
    if (s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")) {
      return Number(s.replace(/\./g, "").replace(",", "."));
    }
    return Number(s.replace(/,/g, ""));
  };
  const formatPriceBRL = (n) =>
    isFinite(n) && n > 0
      ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "";

  const inCategory = (itemCat, target) => {
    const ic = lower(itemCat);
    const tg = lower(target);
    if (!ic || !tg) return false;
    const aliases = CATEGORY_ALIASES[tg] || [tg];
    return [ic, ic.replace(/s$/, "")].some((c) => aliases.includes(c));
  };

  // Normaliza um registro bruto da planilha para o formato interno
  function normalizeRow(row) {
    return {
      id: norm(row.ID),
      status: lower(row.Status) || "ativo",
      categoria: norm(row.Categoria),
      marca: norm(row.Marca),
      nome: norm(row.Nome),
      descricao: norm(row.Descricao),
      preco: moneyToNumber(row.Preco),
      precoDe: moneyToNumber(row.PrecoDe),
      destaque: isTruthy(row.Destaque),
      img: norm(row.ImagemURL),
      wa: norm(row.LinkWA),
      createdAt: norm(row.CreatedAt),
      updatedAt: norm(row.UpdateAt),
      // para busca:
      haystack: [
        row.ID,
        row.Categoria,
        row.Marca,
        row.Nome,
        row.Descricao,
        row.Preco,
        row.PrecoDe,
      ]
        .map(norm)
        .join(" ")
        .toLowerCase(),
    };
  }

  // Render de um card
  function renderCard(p) {
    const preco = formatPriceBRL(p.preco);
    const precoDe = p.precoDe && p.precoDe > p.preco ? formatPriceBRL(p.precoDe) : "";
    const searchAttr = [
      p.nome,
      p.descricao,
      p.marca,
      p.categoria,
      preco,
      precoDe,
    ]
      .join(" ")
      .toLowerCase();

    const waHref =
      p.wa ||
      `https://wa.me/5521976950809?text=${encodeURIComponent(
        `Olá, Nando! Vim pelo site e me interessei por: ${p.nome}. Pode me atender?`
      )}`;

    return `
<article class="offer-card rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden"
         data-brand="${lower(p.marca)}"
         data-price="${p.preco || 0}"
         data-new="${p.createdAt || ""}"
         data-search="${searchAttr}">
  <img src="${p.img || "assets/celulares/fallback-celular.jpg"}"
       alt="${escapeHtml(p.nome)}"
       class="w-full h-52 object-cover"
       onerror="this.onerror=null;this.src='assets/celulares/fallback-celular.jpg'">
  <div class="p-5">
    <h2 class="font-bold text-lg">${escapeHtml(p.nome)}</h2>
    <p class="text-sm text-slate-600">${escapeHtml(p.descricao || "")}</p>
    <div class="mt-3">
      ${precoDe ? `<div class="price-strike text-xs">${precoDe}</div>` : ""}
      <div class="text-xl font-extrabold text-blue-700">${preco || ""}</div>
    </div>
    <a class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-white font-extrabold border border-white/30 shadow-[0_12px_28px_rgba(16,185,129,.35)] bg-[conic-gradient(at_50%_50%,#16a34a,#10b981,#06b6d4,#16a34a)] hover:brightness-110 transition mt-4 w-full"
       href="${waHref}" target="_blank" rel="noopener">
       Falar no WhatsApp
    </a>
  </div>
</article>`;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // =========================
  // FONTE: PLANILHA
  // =========================
  async function fetchSheet() {
    if (!SHEET_WEBAPP_URL) return [];
    try {
      const res = await fetch(SHEET_WEBAPP_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status + " " + res.statusText);
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .map(normalizeRow)
        .filter((p) => p.status === "ativo" && p.nome && p.categoria);
    } catch (err) {
      console.warn("[NandoCatalog] Falha ao ler planilha:", err);
      return [];
    }
  }

  // =========================
  // FONTE: LOCAL (opcional)
  // =========================
  // Se quiser usar local, defina window.LOCAL_PRODUCTS = [ { … } ] antes deste arquivo
  function fetchLocal() {
    const arr = Array.isArray(window.LOCAL_PRODUCTS) ? window.LOCAL_PRODUCTS : [];
    return arr
      .map(normalizeRow)
      .filter((p) => p.status === "ativo" && p.nome && p.categoria);
  }

  // =========================
  // PÚBLICO
  // =========================
  async function renderCatalogSimple({ pageLabel = "Catálogo", categoria = "tudo" } = {}) {
    // Carrega fontes
    const [fromSheet, fromLocal] = await Promise.all([fetchSheet(), fetchLocal()]);
    // Merge (sheet tem prioridade sobre local por ID, se ID coincidir)
    const map = new Map();
    for (const p of fromLocal) map.set(p.id || `${p.nome}|${p.img}`, p);
    for (const p of fromSheet) map.set(p.id || `${p.nome}|${p.img}`, p);
    let items = Array.from(map.values());

    // Filtra por categoria se não for "tudo"
    if (lower(categoria) !== "tudo") {
      items = items.filter((p) => inCategory(p.categoria, categoria));
    }

    // Render no grid existente
    const grid = document.getElementById("gridProdutos");
    const countEl = document.getElementById("countVisible");
    const empty = document.getElementById("emptyState");

    if (!grid) {
      console.warn("[NandoCatalog] gridProdutos não encontrado.");
      return;
    }

    if (!items.length) {
      grid.innerHTML = "";
      if (empty) empty.classList.remove("hidden");
      if (countEl) countEl.textContent = "0";
      return;
    }

    // monta HTML
    grid.innerHTML = items.map(renderCard).join("");
    if (empty) empty.classList.add("hidden");
    if (countEl) countEl.textContent = String(items.length);

    // aplica filtros/ordenação já existentes na página (se houver)
    // — seu script da página mantém os listeners; aqui não duplicamos nada.
  }

  // expõe global
  window.NandoCatalog = {
    renderCatalogSimple,
  };
})();
