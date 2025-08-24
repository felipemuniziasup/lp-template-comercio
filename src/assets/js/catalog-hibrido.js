// src/js/catalog-hibrido.js
import { produtosLocais } from "./produtos.js";

// URL da planilha publicada (formato JSON/CSV → já ajusto)
const PLANILHA_URL = "https://docs.google.com/spreadsheets/d/SEU_ID/export?format=csv";

async function carregarPlanilha() {
  try {
    const resp = await fetch(PLANILHA_URL);
    if (!resp.ok) throw new Error("Falha ao buscar planilha");
    const texto = await resp.text();

    // CSV → JSON simples
    const linhas = texto.split("\n").map(l => l.split(","));
    const cabecalho = linhas.shift();
    return linhas.map(l => {
      const item = {};
      cabecalho.forEach((col, i) => {
        item[col.trim()] = (l[i] || "").trim();
      });
      return {
        nome: item.nome,
        preco: Number(item.preco),
        precoDe: Number(item.precoDe || 0),
        marca: item.marca?.toLowerCase(),
        imagem: item.imagem,
        descricao: item.descricao,
        novo: item.novo || "2000-01-01"
      };
    });
  } catch (e) {
    console.warn("⚠️ Erro ao carregar planilha:", e.message);
    return [];
  }
}

async function carregarCatalogo() {
  const daPlanilha = await carregarPlanilha();
  const todos = [...produtosLocais, ...daPlanilha];
  renderizarProdutos(todos);
}

function renderizarProdutos(lista) {
  const grid = document.getElementById("gridProdutos");
  const countEl = document.getElementById("countVisible");
  const empty = document.getElementById("emptyState");

  grid.innerHTML = "";

  lista.forEach(prod => {
    const card = document.createElement("article");
    card.className = "offer-card rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden";
    card.setAttribute("data-brand", prod.marca || "outros");
    card.setAttribute("data-price", prod.preco);
    card.setAttribute("data-new", prod.novo || "2000-01-01");
    card.setAttribute("data-search", `${prod.nome} ${prod.descricao}`.toLowerCase());

    card.innerHTML = `
      <img src="${prod.imagem}" alt="${prod.nome}"
           class="w-full h-52 object-cover"
           onerror="this.onerror=null;this.src='assets/celulares/fallback-celular.jpg'">
      <div class="p-5">
        <h2 class="font-bold text-lg">${prod.nome}</h2>
        <p class="text-sm text-slate-600">${prod.descricao}</p>
        <div class="mt-3">
          ${prod.precoDe ? `<div class="price-strike text-xs">R$ ${prod.precoDe}</div>` : ""}
          <div class="text-xl font-extrabold text-blue-700">R$ ${prod.preco}</div>
        </div>
        <a class="btn-wa mt-4 w-full" data-wa-product="${prod.nome}">Falar no WhatsApp</a>
      </div>
    `;
    grid.appendChild(card);
  });

  countEl.textContent = lista.length;
  empty.classList.toggle("hidden", lista.length > 0);
}

carregarCatalogo();
