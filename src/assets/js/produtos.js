async function carregarProdutos() {
  const id = window.PLANILHA_ID;
  const url = `https://docs.google.com/spreadsheets/d/e/${id}/pub?output=csv`;

  const resp = await fetch(url);
  const csv = await resp.text();

  // converte CSV → array
  const linhas = csv.trim().split("\n").map(l => l.split(","));
  const cabecalho = linhas.shift();
  const produtos = linhas.map(linha => {
    const obj = {};
    cabecalho.forEach((col, i) => obj[col.trim()] = linha[i]);
    return obj;
  });

  renderizarProdutos(produtos);
}

function renderizarProdutos(lista) {
  const grid = document.getElementById("gridProdutos");
  if (!grid) return;

  grid.innerHTML = ""; // limpa
  let count = 0;

  lista.forEach(prod => {
    if (prod.STATUS === "oculto") return;

    count++;
    const vendido = prod.STATUS === "vendido";

    grid.innerHTML += `
      <article class="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
        <img src="${prod.IMG}" alt="${prod.TITULO}" class="w-full h-52 object-cover">
        <div class="p-5">
          <h2 class="font-bold text-lg">${prod.TITULO}</h2>
          <p class="text-sm text-slate-600">${prod.DESCR}</p>
          <div class="mt-3">
            <div class="text-xs text-slate-400 line-through">${prod.PRECO_DE || ""}</div>
            <div class="text-xl font-extrabold text-blue-700">${prod.PRECO}</div>
          </div>
          ${
            vendido 
            ? `<button disabled class="mt-4 w-full px-4 py-2.5 rounded-full bg-slate-400 text-white font-bold">VENDIDO</button>`
            : `<a href="https://wa.me/5521976950809?text=Tenho%20interesse%20no%20${encodeURIComponent(prod.TITULO)}" 
                 target="_blank" rel="noopener"
                 class="mt-4 inline-flex w-full justify-center items-center px-4 py-2.5 rounded-full text-white font-extrabold
                 border border-white/30 shadow-[0_12px_28px_rgba(16,185,129,.35)]
                 bg-[conic-gradient(at_50%_50%,#16a34a,#10b981,#06b6d4,#16a34a)]
                 hover:brightness-110 transition">
                 Comprar no WhatsApp
               </a>`
          }
        </div>
      </article>
    `;
  });

  // contador
  const countEl = document.getElementById("countVisible");
  if (countEl) countEl.textContent = count;
}

document.addEventListener("DOMContentLoaded", carregarProdutos);
