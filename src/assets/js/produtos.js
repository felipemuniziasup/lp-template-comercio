// assets/js/produtos.js
// ESM: fornece apenas `produtosLocais` para o catalog-hibrido.js

// Converte "2.199,90" / "2199,90" / "2199" em Number
function parsePrecoBR(v) {
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  s = s.replace(/[R$\s]/g, "");
  if (s.indexOf(",") > -1 && s.lastIndexOf(",") > s.lastIndexOf(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// "1","true","sim","yes"
function parseBool(v) {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "sim" || s === "yes";
}

// Normaliza qualquer objeto (se vier de window.LOCAL_PRODUCTS) para o contrato esperado
function mapToContrato(x = {}) {
  const nome = x.nome ?? x.titulo ?? x.Nome ?? x.Titulo ?? "Produto";
  const preco = parsePrecoBR(x.preco ?? x.Preco ?? x.price);
  const precoDe = parsePrecoBR(x.precoDe ?? x.PrecoDe ?? x.de);
  const marca =
    (x.marca ?? x.Marca ?? x.brand ?? x.Brand ?? "outros").toString().toLowerCase();
  const imagem = x.imagem ?? x.image ?? x.ImagemURL ?? x.img ?? "";
  const descricao = x.descricao ?? x.desc ?? x.Descricao ?? "";
  const novo = x.novo ?? x.data ?? x.createdAt ?? x.CreatedAt ?? "2000-01-01";
  const featured = !!(x.featured ?? x.destaque ?? x.Destaque);
  const promo = !!(x.promo ?? x.promocao ?? x["promoção"]);

  return { nome, preco, precoDe, marca, imagem, descricao, novo, featured, promo };
}

// Se você quiser declarar produtos locais direto no HTML, pode fazer:
// <script>window.LOCAL_PRODUCTS = [ { Nome:"POCO X7 Pro", Preco:"1899", Marca:"POCO", ImagemURL:"assets/celulares/poco-x7-pro.jpg", Descricao:"8GB · 256GB" } ]</script>
// Este arquivo irá normalizar esses itens automaticamente.
const produtosDeJanela = Array.isArray(window?.LOCAL_PRODUCTS)
  ? window.LOCAL_PRODUCTS.map(mapToContrato)
  : [];

// Se quiser manter este arquivo só como “vazio” e deixar os cards mock do HTML,
// deixe o array abaixo como [].
const produtosFixos = [
  // Exemplo comentado (opcional):
  // mapToContrato({
  //   nome: "POCO X7 Pro",
  //   preco: 1899,
  //   precoDe: 2199,
  //   marca: "poco",
  //   imagem: "assets/celulares/poco-x7-pro.jpg",
  //   descricao: "8GB · 256GB · Snapdragon 7s Gen 2",
  //   novo: "2024-03-01",
  //   featured: true,
  //   promo: true
  // }),
];

// Exporta o que o catalog-hibrido.js consome
export const produtosLocais = [...produtosFixos, ...produtosDeJanela];
