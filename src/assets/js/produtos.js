/* ===========================================================
   produtos.js — catálogo dinâmico via Planilha
   =========================================================== */

// 1) CONFIG — COLE A URL DO WEB APP
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyUQssHJB5klpYZy2br9rQhNz8Ku0Bt_11fxUGcaW2XhTmtbuwYTGjd92PzKR8i44L6/execCOLE_AQUI_A_URL_DO_WEB_APP'; // ex: https://script.google.com/macros/s/XXXXX/exec

// 2) UTIL
const moneyBRL = n => (n ? n.toLocaleString('pt-BR', { style:'currency', currency:'BRL' }) : '—');
const el = (sel, root=document) => root.querySelector(sel);
const els = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const fmtSlug = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

// 3) FETCH + CACHE
let _cacheData = null;
async function fetchProdutos(force=false){
  if (_cacheData && !force) return _cacheData;
  const url = WEB_APP_URL + (WEB_APP_URL.includes('?') ? '&' : '?') + 't=' + Date.now();
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Erro ao carregar catálogo');
  const json = await res.json();
  _cacheData = json;
  return json;
}

// 4) CARD TEMPLATE
function buildCard(p, pageLabel){
  const vendido = p.status === 'vendido';
  const precoDe = p.precoDe && p.precoDe > p.preco ? `<div class="price-strike text-xs">${moneyBRL(p.precoDe)}</div>` : '';
  const preco   = p.preco ? `<div class="text-xl font-extrabold text-blue-700">${moneyBRL(p.preco)}</div>` : '';
  const desc    = p.descricao ? `<p class="text-sm text-slate-600">${p.descricao}</p>` : '';

  // imagem com fallback
  const img = p.imagem || '';
  const onerr = `this.onerror=null;this.src='assets/${p.categoria === 'perfumes' ? 'perfumes' : 'celulares'}/fallback-${p.categoria === 'perfumes' ? 'perfume' : 'celular'}.jpg'`;

  // mensagem WA contextual
  const msg = `Olá, Nando! Vim pelo site (${pageLabel}) e me interessei por: ${p.nome}. Pode me atender?`;
  const wa  = p.linkWA || `https://wa.me/5521976950809?text=${encodeURIComponent(msg)}`;

  const ctaLabel = vendido ? 'Falar sobre similares' : 'Falar no WhatsApp';
  const ctaClass = vendido
    ? 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-white font-extrabold border border-white/30 shadow-[0_12px_28px_rgba(16,185,129,.35)] bg-slate-500 hover:brightness-110 transition'
    : 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-white font-extrabold border border-white/30 shadow-[0_12px_28px_rgba(16,185,129,.35)] bg-[conic-gradient(at_50%_50%,#16a34a,#10b981,#06b6d4,#16a34a)] hover:brightness-110 transition';

  const badgeVendido = vendido ? `<span class="absolute top-3 left-3 bg-red-600 text-white text-xs px-2 py-1 rounded-full">Vendido</span>` : '';
  const badgeDestaque = p.destaque ? `<span class="absolute top-3 right-3 bg-amber-500 text-white text-xs px-2 py-1 rounded-full">Destaque</span>` : '';

  return `
  <article class="offer-card rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden"
           data-cat="${p.categoria}" data-brand="${p.marca}" data-price="${p.preco||0}" data-new="${p.createdAt||''}"
           data-search="${[p.nome, p.descricao, p.marca].join(' ').toLowerCase()}">
    <div class="relative">
      ${badgeVendido}${badgeDestaque}
      <img src="${img}" alt="${p.nome}" class="w-full h-52 object-cover" onerror="${onerr}">
    </div>
    <div class="p-5">
      <h2 class="font-bold text-lg">${p.nome}</h2>
      ${desc}
      <div class="mt-3">
        ${precoDe}
        ${preco}
      </div>
      <a href="${wa}" target="_blank" rel="noopener" class="btn-wa mt-4 w-full ${ctaClass}">
        ${ctaLabel}
      </a>
    </div>
  </article>`;
}

// 5) RENDER GERAL (para tudo.html com filtros completos)
async function renderCatalogFull(opts={}){
  const {
    mountSelector = '#gridProdutos',
    countSelector = '#countVisible',
    emptySelector = '#emptyState',
    pageLabel = 'Catálogo completo',
    initialCat = 'all',
    controls = {
      search: '#search',
      chips: '.chip[data-cat]',
      brand: '#brand',
      sort:  '#sort',
    }
  } = opts;

  const mount = el(mountSelector);
  if (!mount) return;

  const data = await fetchProdutos();
  const items = data.items || [];

  // monta HTML inicial
  mount.innerHTML = items.map(p => buildCard(p, pageLabel)).join('');

  // coleta elementos
  const cards = els('article.offer-card', mount);
  const countEl = el(countSelector);
  const emptyEl = el(emptySelector);
  const inputSearch = el(controls.search);
  const sortSel = el(controls.sort);
  const brandSel= el(controls.brand);
  const chips   = els(controls.chips);

  // popula marcas dinamicamente
  const brandSet = new Set(items.map(i => i.marca).filter(Boolean));
  if (brandSel) {
    // mantém "all"
    brandSel.querySelectorAll('option[value!="all"]').forEach(o=>o.remove());
    [...brandSet].sort().forEach(m=>{
      const opt = document.createElement('option');
      opt.value = m; opt.textContent = m.charAt(0).toUpperCase()+m.slice(1);
      brandSel.appendChild(opt);
    });
  }

  // estado
  let activeQuery = '';
  let activeCat   = initialCat;
  let activeBrand = 'all';

  // chips estado inicial
  chips.forEach(c=>c.classList.toggle('active', c.getAttribute('data-cat')===activeCat));

  // aplicar filtros
  function aplicar(){
    // ordenação
    const toSort = [...cards];
    const key = sortSel ? sortSel.value : 'featured';
    toSort.sort((a,b)=>{
      const pa = Number(a.getAttribute('data-price')) || 0;
      const pb = Number(b.getAttribute('data-price')) || 0;
      const da = new Date(a.getAttribute('data-new') || '2000-01-01').getTime();
      const db = new Date(b.getAttribute('data-new') || '2000-01-01').getTime();
      switch (key){
        case 'price-asc': return pa - pb;
        case 'price-desc': return pb - pa;
        case 'newest': return db - da;
        default: return 0;
      }
    }).forEach(card => mount.appendChild(card));

    // filtros
    let visible=0;
    cards.forEach(card=>{
      const cat = (card.getAttribute('data-cat')||'').toLowerCase();
      const br  = (card.getAttribute('data-brand')||'').toLowerCase();
      const hay = (card.getAttribute('data-search')||'').toLowerCase();
      const passCat   = activeCat==='all' ? true : (cat===activeCat);
      const passBrand = activeBrand==='all' ? true : (br===activeBrand);
      const passQuery = activeQuery ? hay.includes(activeQuery) : true;
      const show = passCat && passBrand && passQuery;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    if (countEl) countEl.textContent = String(visible);
    if (emptyEl) emptyEl.classList.toggle('hidden', visible !== 0);
  }

  // eventos
  chips.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      activeCat = btn.getAttribute('data-cat') || 'all';
      chips.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      aplicar();
    });
  });

  if (brandSel) brandSel.addEventListener('change', ()=>{ activeBrand = brandSel.value || 'all'; aplicar(); });
  if (sortSel)  sortSel.addEventListener('change', aplicar);

  if (inputSearch) {
    let t; inputSearch.addEventListener('input', ()=>{
      clearTimeout(t);
      t = setTimeout(()=>{ activeQuery = (inputSearch.value||'').trim().toLowerCase(); aplicar(); }, 180);
    });
  }

  aplicar();
}

// 6) RENDER SIMPLES (para celulares.html, perfumes.html)
async function renderCatalogSimple(opts={}){
  const { mountSelector = '#gridProdutos', pageLabel = 'Catálogo', categoria='celulares' } = opts;
  const mount = el(mountSelector);
  if (!mount) return;

  const data = await fetchProdutos();
  const items = (data.items||[]).filter(p => p.categoria === categoria && p.status !== 'oculto');

  // ordena: destaque > mais novos > preço
  items.sort((a,b)=>{
    if (a.destaque !== b.destaque) return a.destaque? -1 : 1;
    const da = new Date(a.createdAt||'2000-01-01') - new Date(b.createdAt||'2000-01-01');
    if (da !== 0) return -da;
    return (a.preco||0) - (b.preco||0);
  });

  mount.innerHTML = items.map(p => buildCard(p, pageLabel)).join('');
}

// 7) EXPOSE (para chamar nas páginas)
window.NandoCatalog = {
  renderCatalogFull,   // tudo.html
  renderCatalogSimple, // celulares.html, perfumes.html
};
