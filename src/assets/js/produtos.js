// ======= CONFIG =======
const WEB_APP_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890'; // seu ID do Apps Script (Web App)
const API_URL = `https://script.google.com/macros/s/${WEB_APP_ID}/exec`; // retorna JSON
const CATEGORIES = ['celulares','perfumes']; // mapeadas no sheet

// ======= UTIL =======
const pageName = location.pathname.split('/').pop() || 'index.html';
const toBRL = (n)=> n ? n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '';

function buildWaText(prod) {
  const base = `Olá Nando! Vim pelo site (${pageName}).`;
  const prodTxt = prod ? `\n\nMe interessei por:\n• ${prod.nome}\n• ${prod.especificacoes||''}\n• Preço: ${prod.preco_final ? toBRL(prod.preco_final) : (prod.preco||'—')}` : '';
  const ask = `\n\nPode me atender?`;
  return encodeURIComponent(base + prodTxt + ask);
}

function createCard(p) {
  const vendido = p.status === 'Vendido';
  const destaque = p.tag === 'Destaque';
  const precoDe = p.preco_de ? `<div class="text-xs text-slate-400 line-through">${toBRL(p.preco_de)}</div>` : '';
  const preco = p.preco_final ? `<div class="text-xl font-extrabold text-blue-700">${toBRL(p.preco_final)}</div>` : '';
  const badge = vendido ? `<span class="absolute top-2 left-2 bg-rose-600 text-white text-[11px] px-2 py-1 rounded-full">Vendido</span>`
                        : (destaque ? `<span class="absolute top-2 left-2 bg-amber-500 text-white text-[11px] px-2 py-1 rounded-full">Destaque</span>` : '');

  const btn = vendido
    ? `<button disabled class="inline-flex w-full justify-center items-center gap-2 mt-3 px-4 py-2.5 rounded-full bg-slate-300 text-slate-600 font-extrabold cursor-not-allowed">Indisponível</button>`
    : `<a class="inline-flex w-full justify-center items-center gap-2 mt-3 px-4 py-2.5 rounded-full text-white font-extrabold
                  border border-white/30 shadow-[0_12px_28px_rgba(16,185,129,.35)]
                  bg-[conic-gradient(at_50%_50%,#16a34a,#10b981,#06b6d4,#16a34a)]
                  hover:brightness-110 transition"
          href="https://wa.me/5521976950809?text=${buildWaText(p)}" target="_blank" rel="noopener">
          Comprar no WhatsApp
       </a>`;

  return `
  <article class="relative bg-white rounded-2xl shadow hover:shadow-lg overflow-hidden border border-slate-200 transition"
           data-category="${(p.categoria||'').toLowerCase()}"
           data-search="${(p.busca||'').toLowerCase()}">
    ${badge}
    <img src="${p.foto}" alt="${p.nome}" class="w-full h-52 object-cover"
         onerror="this.onerror=null;this.src='assets/logo-monogram-512.png';this.style.objectFit='contain';this.style.padding='16px'">
    <div class="p-5">
      <h2 class="font-bold text-lg">${p.nome}</h2>
      <p class="text-sm text-slate-600">${p.especificacoes||''}</p>
      <div class="mt-3">
        ${precoDe}
        ${preco}
      </div>
      ${btn}
    </div>
  </article>`;
}

async function fetchProdutos() {
  try {
    const res = await fetch(API_URL, {cache: 'no-store'});
    if (!res.ok) throw new Error('API retornou erro');
    const data = await res.json(); // espera array de produtos
    return Array.isArray(data) ? data : (data.produtos || []);
  } catch (err) {
    console.warn('[produtos] Falha API, usando fallback se houver.', err);
    // fallback mínimo (opcional): retorna vazio
    return [];
  }
}

function aplicarFiltroInicial(grid, cards) {
  const params = new URLSearchParams(location.search);
  const q = (params.get('q') || '').trim().toLowerCase();
  let visible = 0;
  cards.forEach(card=>{
    const hay = (card.getAttribute('data-search')||'').toLowerCase();
    const show = q ? hay.includes(q) : true;
    card.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  const countEl = document.getElementById('countVisible');
  const empty = document.getElementById('emptyState');
  const qHolders = document.querySelectorAll('[data-q]');
  if (countEl) countEl.textContent = visible;
  if (empty) empty.classList.toggle('hidden', visible !== 0);
  qHolders.forEach(el => el.textContent = q || '');
}

(async function initCatalog(){
  const grids = document.querySelectorAll('#gridProdutos, #gridCelulares, #gridPerfumes');
  if (!grids.length) return;
  const produtos = await fetchProdutos();

  // Render
  grids.forEach(grid=>{
    const destino = grid.id.includes('Celulares') ? 'celulares'
                   : grid.id.includes('Perfumes') ? 'perfumes'
                   : 'all';

    const list = produtos.filter(p=>{
      const cat = (p.categoria||'').toLowerCase();
      if (destino==='all') return true;
      return cat === destino;
    });

    grid.innerHTML = list.map(createCard).join('') || `
      <div class="col-span-full text-center text-slate-600">Nenhum produto disponível no momento.</div>
    `;
  });

  // Filtro inicial (q=)
  document.querySelectorAll('#gridProdutos').forEach(grid=>{
    const cards = Array.from(grid.querySelectorAll('article[data-category]'));
    aplicarFiltroInicial(grid, cards);
  });

  // Botões de filtro (tudo.html)
  const filterButtons = Array.from(document.querySelectorAll('button[data-filter]'));
  if (filterButtons.length) {
    let activeCategory = 'all';
    filterButtons.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        activeCategory = btn.getAttribute('data-filter')||'all';
        filterButtons.forEach(b => b.style.background = 'rgba(255,255,255,.10)');
        btn.style.background = 'rgba(255,255,255,.22)';
        const grid = document.getElementById('gridProdutos');
        if (!grid) return;
        const cards = Array.from(grid.querySelectorAll('article[data-category]'));
        let visible = 0;
        cards.forEach(card=>{
          const cat = card.getAttribute('data-category');
          const show = (activeCategory==='all') ? true : (cat===activeCategory);
          card.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        const countEl = document.getElementById('countVisible');
        const empty = document.getElementById('emptyState');
        if (countEl) countEl.textContent = visible;
        if (empty) empty.classList.toggle('hidden', visible !== 0);
      });
    });
  }
})();
