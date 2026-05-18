"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Lock, Plus, Save, Trash2 } from "@/components/Icons";
import { formatCurrency } from "@/lib/format";
import type { InventoryIngredient, InventoryProduct } from "@/lib/inventory";

type Tab = "dashboard" | "ingredients" | "products" | "cards" | "production" | "sales" | "history";

type Summary = {
  ingredients: InventoryIngredient[];
  products: InventoryProduct[];
  productions: Record<string, unknown>[];
  sales: {
    id: number;
    productId: number;
    productName: string;
    quantity: number;
    saleDate: string;
    totalValue: number;
    paymentMethod: string;
    estimatedProfit: number;
    notes: string;
  }[];
  movements: Record<string, unknown>[];
  totalStockValue: number;
  lowIngredients: InventoryIngredient[];
  averageProductCost: number;
  topProducts: { productId: number; name: string; quantity: number; revenue: number }[];
};

const today = new Date().toISOString().slice(0, 10);
const units = ["g", "kg", "ml", "litros", "unidade", "caixa", "pacote"];

const blankIngredient = {
  name: "",
  unit: "g",
  currentQuantity: 0,
  minimumQuantity: 0,
  purchaseCost: 0,
  supplier: "",
  lastPurchaseDate: today,
  expiryDate: ""
};

const blankProduct = {
  name: "",
  category: "Docinhos",
  salePrice: 0,
  packagingName: "",
  packagingCost: 0,
  productionTime: "",
  notes: "",
  finishedStock: 0,
  trackFinishedStock: true,
  desiredMargin: 60
};

const blankEntry = {
  ingredientId: 0,
  quantity: 0,
  unitCost: 0,
  supplier: "",
  lastPurchaseDate: today,
  expiryDate: "",
  note: ""
};

const blankProduction = {
  productId: 0,
  quantityProduced: 0,
  productionDate: today,
  expiryDate: "",
  notes: ""
};

const blankSale = {
  productId: 0,
  quantity: 1,
  saleDate: today,
  totalValue: 0,
  paymentMethod: "Pix",
  notes: ""
};

function asText(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: unknown) {
  const text = asText(value);
  if (!text) return "-";
  return new Date(`${text}T00:00:00`).toLocaleDateString("pt-BR");
}

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "danger" | "good" }) {
  const styles = {
    neutral: "bg-cream text-cocoa",
    danger: "bg-blush/30 text-cocoa",
    good: "bg-pistachio/25 text-cocoa"
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${styles[tone]}`}>{children}</span>;
}

export default function StockPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ingredient, setIngredient] = useState(blankIngredient);
  const [product, setProduct] = useState(blankProduct);
  const [entry, setEntry] = useState(blankEntry);
  const [production, setProduction] = useState(blankProduction);
  const [sale, setSale] = useState(blankSale);
  const [cardProductId, setCardProductId] = useState(0);
  const [card, setCard] = useState({
    yieldQuantity: 1,
    yieldWeightGrams: 0,
    unitWeightGrams: 0,
    notes: "",
    items: [{ ingredientId: 0, quantity: 0 }]
  });

  const selectedSaleProduct = summary?.products.find((item) => item.id === sale.productId);
  const selectedCardProduct = summary?.products.find((item) => item.id === cardProductId);
  const calculatedCardYield =
    card.yieldWeightGrams > 0 && card.unitWeightGrams > 0 ? card.yieldWeightGrams / card.unitWeightGrams : card.yieldQuantity;
  const dashboard = useMemo(() => {
    if (!summary) return null;
    const estimatedRevenue = summary.sales.reduce((sum, item) => sum + item.totalValue, 0);
    const estimatedProfit = summary.sales.reduce((sum, item) => sum + item.estimatedProfit, 0);
    return { estimatedRevenue, estimatedProfit };
  }, [summary]);

  async function load(secret = password) {
    const response = await fetch("/api/inventory", { headers: { "x-admin-password": secret } });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Senha invalida.");
      setUnlocked(false);
      return;
    }
    setSummary(data);
    setUnlocked(true);
    setMessage("");

    if (!cardProductId && data.products?.[0]) {
      fillCard(data.products[0]);
    }
    if (!entry.ingredientId && data.ingredients?.[0]) {
      setEntry((current) => ({ ...current, ingredientId: data.ingredients[0].id, unitCost: data.ingredients[0].purchaseCost }));
    }
    if (!production.productId && data.products?.[0]) setProduction((current) => ({ ...current, productId: data.products[0].id }));
    if (!sale.productId && data.products?.[0]) setSale((current) => ({ ...current, productId: data.products[0].id, totalValue: data.products[0].salePrice }));
  }

  useEffect(() => {
    const stored = window.localStorage.getItem("ibejinhos-admin-password");
    if (stored) {
      setPassword(stored);
      load(stored);
    }
  }, []);

  async function send(action: string, payload: Record<string, unknown>, success: string) {
    const response = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({ action, ...payload })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Nao foi possivel salvar.");
      return false;
    }
    setMessage(success);
    await load(password);
    return true;
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem("ibejinhos-admin-password", password);
    await load(password);
  }

  function fillCard(item: InventoryProduct) {
    setCardProductId(item.id);
    setCard({
      yieldQuantity: item.card?.yieldQuantity ?? 1,
      yieldWeightGrams: item.card?.yieldWeightGrams ?? 0,
      unitWeightGrams: item.card?.unitWeightGrams ?? 0,
      notes: item.card?.notes ?? "",
      items: item.card?.items.length ? item.card.items.map((cardItem) => ({ ingredientId: cardItem.ingredientId, quantity: cardItem.quantity })) : [{ ingredientId: 0, quantity: 0 }]
    });
  }

  async function handleDeleteCard() {
    if (!selectedCardProduct?.card) {
      setMessage("Este produto ainda nao tem ficha tecnica para excluir.");
      return;
    }

    const confirmed = window.confirm(`Excluir a ficha tecnica de ${selectedCardProduct.name}? O produto continua cadastrado.`);
    if (!confirmed) return;

    const deleted = await send("deleteCard", { productId: selectedCardProduct.id }, "Ficha tecnica excluida.");
    if (deleted) {
      setCard({
        yieldQuantity: 1,
        yieldWeightGrams: 0,
        unitWeightGrams: 0,
        notes: "",
        items: [{ ingredientId: 0, quantity: 0 }]
      });
    }
  }

  if (!unlocked || !summary) {
    return (
      <main className="mx-auto grid min-h-[calc(100vh-76px)] max-w-md place-items-center px-4">
        <form onSubmit={handleLogin} className="w-full rounded-lg border border-cocoa/10 bg-white/85 p-6 shadow-soft">
          <Lock className="mb-4 text-gold" size={30} />
          <h1 className="text-2xl font-black text-cocoa">Estoque da Ibejinhos</h1>
          <p className="mt-2 leading-6 text-truffle">Use a senha do painel para controlar ingredientes, fichas tecnicas, producao e vendas.</p>
          <input
            className="mt-5 w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3"
            placeholder="Senha"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {message && <p className="mt-3 rounded-lg bg-blush/50 p-3 text-sm font-bold text-cocoa">{message}</p>}
          <button className="mt-5 w-full rounded-full bg-cocoa px-5 py-3 font-black text-cream">Entrar</button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-gold">Controle geral</p>
          <h1 className="mt-2 text-3xl font-black text-cocoa sm:text-5xl">Estoque Ibejinhos</h1>
          <p className="mt-3 max-w-2xl leading-7 text-truffle">Comece cadastrando os ingredientes. Depois cadastre os produtos que voce fabrica e monte a receita com a quantidade usada de cada ingrediente.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-lg bg-white/82 p-4 shadow-soft">
            <span className="block font-bold text-truffle">Estoque</span>
            <strong className="mt-1 block text-lg text-cocoa">{formatCurrency(summary.totalStockValue)}</strong>
          </div>
          <div className="rounded-lg bg-white/82 p-4 shadow-soft">
            <span className="block font-bold text-truffle">Alertas</span>
            <strong className="mt-1 block text-lg text-cocoa">{summary.lowIngredients.length}</strong>
          </div>
          <div className="rounded-lg bg-white/82 p-4 shadow-soft">
            <span className="block font-bold text-truffle">Custo medio</span>
            <strong className="mt-1 block text-lg text-cocoa">{formatCurrency(summary.averageProductCost)}</strong>
          </div>
          <div className="rounded-lg bg-white/82 p-4 shadow-soft">
            <span className="block font-bold text-truffle">Lucro vendas</span>
            <strong className="mt-1 block text-lg text-cocoa">{formatCurrency(dashboard?.estimatedProfit ?? 0)}</strong>
          </div>
        </div>
      </div>

      {message && <p className="mb-5 rounded-lg bg-blush/45 p-3 font-bold text-cocoa">{message}</p>}

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {[
          ["dashboard", "Dashboard"],
          ["ingredients", "1. Ingredientes"],
          ["products", "2. Produtos fabricados"],
          ["cards", "3. Receitas"],
          ["production", "Producao"],
          ["sales", "Baixa por venda"],
          ["history", "Historico"]
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id as Tab)}
            className={`whitespace-nowrap rounded-full px-5 py-3 text-sm font-black ${tab === id ? "bg-cocoa text-cream" : "bg-white text-cocoa"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <section className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
          <div className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft">
            <h2 className="text-xl font-black text-cocoa">Ingredientes em alerta</h2>
            <div className="mt-4 divide-y divide-cocoa/10">
              {summary.lowIngredients.length === 0 && <p className="rounded-lg bg-cream p-4 font-bold text-truffle">Tudo acima do minimo por enquanto.</p>}
              {summary.lowIngredients.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <strong className="block text-cocoa">{item.name}</strong>
                    <span className="text-sm text-truffle">{item.currentQuantity} {item.unit} em estoque, minimo {item.minimumQuantity}</span>
                  </div>
                  <StatusPill tone="danger">Comprar</StatusPill>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft">
            <h2 className="text-xl font-black text-cocoa">Produtos mais vendidos</h2>
            <div className="mt-4 space-y-3">
              {summary.topProducts.length === 0 && <p className="rounded-lg bg-cream p-4 font-bold text-truffle">Registre vendas para ver o ranking.</p>}
              {summary.topProducts.map((item) => (
                <div key={item.productId}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <strong className="text-cocoa">{item.name}</strong>
                    <span className="text-truffle">{item.quantity} un.</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-cream">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(12, item.quantity * 14)}%`, maxWidth: "100%" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft lg:col-span-2">
            <h2 className="text-xl font-black text-cocoa">Margem por produto</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-cream text-cocoa">
                  <tr>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3">Receita un.</th>
                    <th className="px-4 py-3">Emb. do formato</th>
                    <th className="px-4 py-3">Custo final</th>
                    <th className="px-4 py-3">Preco</th>
                    <th className="px-4 py-3">Lucro</th>
                    <th className="px-4 py-3">Margem</th>
                    <th className="px-4 py-3">Estoque pronto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cocoa/10 bg-white">
                  {summary.products.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-black text-cocoa">{item.name}</td>
                      <td className="px-4 py-3 text-truffle">{item.category}</td>
                      <td className="px-4 py-3 text-truffle">{formatCurrency(item.recipeCostPerUnit)}</td>
                      <td className="px-4 py-3 text-truffle">{formatCurrency(item.packagingCost)}</td>
                      <td className="px-4 py-3 text-truffle">{formatCurrency(item.costPerUnit)}</td>
                      <td className="px-4 py-3 text-truffle">{formatCurrency(item.salePrice)}</td>
                      <td className="px-4 py-3 text-truffle">{formatCurrency(item.profitAmount)}</td>
                      <td className="px-4 py-3 text-truffle">{item.profitPercent.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-truffle">{item.finishedStock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {tab === "ingredients" && (
        <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <div className="space-y-5">
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (await send("saveIngredient", { ingredient }, "Ingrediente salvo.")) setIngredient(blankIngredient);
              }}
              className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft"
            >
              <h2 className="text-xl font-black text-cocoa">Cadastrar ingrediente usado</h2>
              <p className="mt-2 text-sm leading-6 text-truffle">Use esta parte para leite condensado, creme de leite, chocolate, manteiga, embalagens e qualquer insumo comprado.</p>
              <div className="mt-4 space-y-3">
                <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Nome do ingrediente. Ex: leite condensado" value={ingredient.name} onChange={(event) => setIngredient({ ...ingredient, name: event.target.value })} />
                <select className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" value={ingredient.unit} onChange={(event) => setIngredient({ ...ingredient, unit: event.target.value })}>
                  {units.map((unit) => <option key={unit}>{unit}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Qtd atual" type="number" step="0.001" value={ingredient.currentQuantity || ""} onChange={(event) => setIngredient({ ...ingredient, currentQuantity: Number(event.target.value) })} />
                  <input className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Qtd minima" type="number" step="0.001" value={ingredient.minimumQuantity || ""} onChange={(event) => setIngredient({ ...ingredient, minimumQuantity: Number(event.target.value) })} />
                </div>
                <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Custo por unidade de medida" type="number" step="0.001" value={ingredient.purchaseCost || ""} onChange={(event) => setIngredient({ ...ingredient, purchaseCost: Number(event.target.value) })} />
                <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Fornecedor" value={ingredient.supplier} onChange={(event) => setIngredient({ ...ingredient, supplier: event.target.value })} />
                <label className="block text-sm font-bold text-cocoa">Ultima compra<input className="mt-1 w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" type="date" value={ingredient.lastPurchaseDate} onChange={(event) => setIngredient({ ...ingredient, lastPurchaseDate: event.target.value })} /></label>
                <label className="block text-sm font-bold text-cocoa">Validade<input className="mt-1 w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" type="date" value={ingredient.expiryDate} onChange={(event) => setIngredient({ ...ingredient, expiryDate: event.target.value })} /></label>
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cocoa px-5 py-3 font-black text-cream"><Save size={18} /> Salvar ingrediente</button>
              </div>
            </form>

            <form
              onSubmit={async (event) => {
                event.preventDefault();
                await send("ingredientEntry", { entry }, "Entrada registrada no estoque.");
              }}
              className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft"
            >
              <h2 className="text-xl font-black text-cocoa">Adicionar compra ao estoque</h2>
              <p className="mt-2 text-sm leading-6 text-truffle">Quando comprar mais ingrediente, registre aqui para somar quantidade, custo, fornecedor e validade.</p>
              <div className="mt-4 space-y-3">
                <select className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" value={entry.ingredientId} onChange={(event) => {
                  const selected = summary.ingredients.find((item) => item.id === Number(event.target.value));
                  setEntry({ ...entry, ingredientId: Number(event.target.value), unitCost: selected?.purchaseCost ?? entry.unitCost });
                }}>
                  {summary.ingredients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Quantidade" type="number" step="0.001" value={entry.quantity || ""} onChange={(event) => setEntry({ ...entry, quantity: Number(event.target.value) })} />
                  <input className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Custo unitario" type="number" step="0.001" value={entry.unitCost || ""} onChange={(event) => setEntry({ ...entry, unitCost: Number(event.target.value) })} />
                </div>
                <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Fornecedor" value={entry.supplier} onChange={(event) => setEntry({ ...entry, supplier: event.target.value })} />
                <label className="block text-sm font-bold text-cocoa">Data da compra<input className="mt-1 w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" type="date" value={entry.lastPurchaseDate} onChange={(event) => setEntry({ ...entry, lastPurchaseDate: event.target.value })} /></label>
                <label className="block text-sm font-bold text-cocoa">Validade<input className="mt-1 w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" type="date" value={entry.expiryDate} onChange={(event) => setEntry({ ...entry, expiryDate: event.target.value })} /></label>
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 font-black text-cocoa"><Plus size={18} /> Registrar entrada</button>
              </div>
            </form>
          </div>

          <div className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft">
            <h2 className="text-xl font-black text-cocoa">Ingredientes cadastrados</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-cream text-cocoa">
                  <tr>
                    <th className="px-4 py-3">Ingrediente</th>
                    <th className="px-4 py-3">Atual</th>
                    <th className="px-4 py-3">Minimo</th>
                    <th className="px-4 py-3">Custo</th>
                    <th className="px-4 py-3">Valor parado</th>
                    <th className="px-4 py-3">Validade</th>
                    <th className="px-4 py-3">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cocoa/10 bg-white">
                  {summary.ingredients.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3"><strong className="block text-cocoa">{item.name}</strong><span className="text-xs text-truffle">{item.supplier || "Sem fornecedor"}</span></td>
                      <td className="px-4 py-3 text-truffle">{item.currentQuantity} {item.unit}</td>
                      <td className="px-4 py-3 text-truffle">{item.minimumQuantity} {item.unit}</td>
                      <td className="px-4 py-3 text-truffle">{formatCurrency(item.purchaseCost)}</td>
                      <td className="px-4 py-3 text-truffle">{formatCurrency(item.currentQuantity * item.purchaseCost)}</td>
                      <td className="px-4 py-3 text-truffle">{formatDate(item.expiryDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setIngredient(item)} className="rounded-full bg-cream px-3 py-2 font-bold text-cocoa">Editar</button>
                          <button type="button" onClick={() => send("deleteIngredient", { id: item.id }, "Ingrediente removido.")} className="rounded-full bg-blush/35 px-3 py-2 text-cocoa"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {tab === "products" && (
        <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (await send("saveProduct", { product }, "Produto salvo.")) setProduct(blankProduct);
            }}
            className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft"
          >
            <h2 className="text-xl font-black text-cocoa">Cadastrar produto fabricado</h2>
            <p className="mt-2 text-sm leading-6 text-truffle">
              Cadastre aqui cada formato que voce vende. Exemplo: brigadeiro unitario sem embalagem de caixa, caixa com 9 brigadeiros com custo da caixa, kit presente com embalagem propria.
            </p>
            <div className="mt-4 space-y-3">
              <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Nome. Ex: brigadeiro tradicional" value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} />
              <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Categoria. Ex: docinhos, bolos, kits" value={product.category} onChange={(event) => setProduct({ ...product, category: event.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Preco" type="number" step="0.01" value={product.salePrice || ""} onChange={(event) => setProduct({ ...product, salePrice: Number(event.target.value) })} />
                <input className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Margem desejada %" type="number" step="1" value={product.desiredMargin || ""} onChange={(event) => setProduct({ ...product, desiredMargin: Number(event.target.value) })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Embalagem do formato. Ex: caixa 9 doces" value={product.packagingName} onChange={(event) => setProduct({ ...product, packagingName: event.target.value })} />
                <input className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Custo embalagem do kit/caixa" type="number" step="0.01" value={product.packagingCost || ""} onChange={(event) => setProduct({ ...product, packagingCost: Number(event.target.value) })} />
              </div>
              <p className="rounded-lg bg-cream px-4 py-3 text-sm font-bold leading-6 text-cocoa">
                Para brigadeiro unitario ou sabor avulso, deixe embalagem em branco e custo R$ 0. A embalagem deve entrar no produto vendido como caixa, kit ou presente.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <input className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Estoque pronto" type="number" step="1" value={product.finishedStock || ""} onChange={(event) => setProduct({ ...product, finishedStock: Number(event.target.value) })} />
                <input className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Tempo medio" value={product.productionTime} onChange={(event) => setProduct({ ...product, productionTime: event.target.value })} />
              </div>
              <label className="flex items-center gap-3 rounded-lg bg-cream px-4 py-3 font-bold text-cocoa"><input type="checkbox" checked={product.trackFinishedStock} onChange={(event) => setProduct({ ...product, trackFinishedStock: event.target.checked })} /> Controlar produto finalizado</label>
              <textarea className="min-h-24 w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Observacoes" value={product.notes} onChange={(event) => setProduct({ ...product, notes: event.target.value })} />
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cocoa px-5 py-3 font-black text-cream"><Save size={18} /> Salvar produto</button>
            </div>
          </form>

          <div className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft">
            <h2 className="text-xl font-black text-cocoa">Produtos fabricados cadastrados</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {summary.products.map((item) => (
                <article key={item.id} className="rounded-lg bg-cream p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-cocoa">{item.name}</h3>
                      <p className="text-sm font-bold text-truffle">{item.category}</p>
                    </div>
                    <StatusPill tone={item.profitAmount >= 0 ? "good" : "danger"}>{item.profitPercent.toFixed(0)}%</StatusPill>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="font-bold text-truffle">Preco</dt><dd className="font-black text-cocoa">{formatCurrency(item.salePrice)}</dd></div>
                    <div><dt className="font-bold text-truffle">Receita un.</dt><dd className="font-black text-cocoa">{formatCurrency(item.recipeCostPerUnit)}</dd></div>
                    <div><dt className="font-bold text-truffle">Emb. formato</dt><dd className="font-black text-cocoa">{formatCurrency(item.packagingCost)}</dd></div>
                    <div><dt className="font-bold text-truffle">Custo final</dt><dd className="font-black text-cocoa">{formatCurrency(item.costPerUnit)}</dd></div>
                    <div><dt className="font-bold text-truffle">Lucro</dt><dd className="font-black text-cocoa">{formatCurrency(item.profitAmount)}</dd></div>
                    <div><dt className="font-bold text-truffle">Sugerido</dt><dd className="font-black text-cocoa">{formatCurrency(item.suggestedPrice)}</dd></div>
                  </dl>
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={() => setProduct(item)} className="rounded-full bg-white px-4 py-2 font-bold text-cocoa">Editar</button>
                    <button type="button" onClick={() => { fillCard(item); setTab("cards"); }} className="rounded-full bg-gold px-4 py-2 font-bold text-cocoa">Receita</button>
                    <button type="button" onClick={() => send("deleteProduct", { id: item.id }, "Produto removido.")} className="rounded-full bg-blush/35 px-4 py-2 text-cocoa"><Trash2 size={16} /></button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "cards" && (
        <section className="grid gap-5 lg:grid-cols-[430px_1fr]">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await send("saveCard", { card: { productId: cardProductId, ...card } }, "Ficha tecnica salva.");
            }}
            className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft"
          >
            <h2 className="text-xl font-black text-cocoa">Receita do produto</h2>
            <p className="mt-2 text-sm leading-6 text-truffle">
              Escolha um formato vendido e informe quanto de cada ingrediente ele usa. Para caixas e kits, coloque a quantidade total de brigadeiros/receita dentro da caixa; o custo da caixa fica no cadastro do produto, nao como custo do brigadeiro unitario.
            </p>
            <div className="mt-4 space-y-3">
              <select className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" value={cardProductId} onChange={(event) => {
                const selected = summary.products.find((item) => item.id === Number(event.target.value));
                if (selected) fillCard(selected);
              }}>
                {summary.products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Rendimento da receita (g)" type="number" step="0.1" value={card.yieldWeightGrams || ""} onChange={(event) => setCard({ ...card, yieldWeightGrams: Number(event.target.value) })} />
                <input className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Peso por unidade (g)" type="number" step="0.1" value={card.unitWeightGrams || ""} onChange={(event) => setCard({ ...card, unitWeightGrams: Number(event.target.value) })} />
              </div>
              <input
                className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3"
                placeholder="Rendimento manual em unidades"
                type="number"
                step="0.01"
                value={card.yieldQuantity || ""}
                onChange={(event) => setCard({ ...card, yieldQuantity: Number(event.target.value) })}
              />
              <p className="rounded-lg bg-cream px-4 py-3 text-sm font-black text-cocoa">
                Rendimento calculado: {calculatedCardYield.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} unidade(s)
              </p>
              <div className="space-y-2">
                {card.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-[1fr_105px_38px] gap-2">
                    <select className="min-w-0 rounded-lg border border-cocoa/15 bg-cream px-3 py-3" value={item.ingredientId} onChange={(event) => {
                      const items = [...card.items];
                      items[index] = { ...items[index], ingredientId: Number(event.target.value) };
                      setCard({ ...card, items });
                    }}>
                      <option value={0}>Ingrediente usado</option>
                      {summary.ingredients.map((ingredientItem) => <option key={ingredientItem.id} value={ingredientItem.id}>{ingredientItem.name}</option>)}
                    </select>
                    <input className="min-w-0 rounded-lg border border-cocoa/15 bg-cream px-3 py-3" placeholder="Qtd" type="number" step="0.001" value={item.quantity || ""} onChange={(event) => {
                      const items = [...card.items];
                      items[index] = { ...items[index], quantity: Number(event.target.value) };
                      setCard({ ...card, items });
                    }} />
                    <button type="button" onClick={() => setCard({ ...card, items: card.items.filter((_, itemIndex) => itemIndex !== index) })} className="grid h-12 w-10 place-items-center rounded-lg bg-blush/30 text-cocoa"><Trash2 size={15} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setCard({ ...card, items: [...card.items, { ingredientId: 0, quantity: 0 }] })} className="inline-flex items-center gap-2 rounded-full bg-cream px-4 py-2 font-black text-cocoa"><Plus size={16} /> Adicionar ingrediente</button>
              </div>
              <textarea className="min-h-20 w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Observacoes da ficha" value={card.notes} onChange={(event) => setCard({ ...card, notes: event.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cocoa px-5 py-3 font-black text-cream"><Save size={18} /> Salvar receita</button>
                <button
                  type="button"
                  onClick={handleDeleteCard}
                  disabled={!selectedCardProduct?.card}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-blush/35 px-5 py-3 font-black text-cocoa"
                >
                  <Trash2 size={18} /> Excluir receita
                </button>
              </div>
            </div>
          </form>

          <div className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft">
            <h2 className="text-xl font-black text-cocoa">Custos calculados pelas receitas</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {summary.products.map((item) => (
                <article key={item.id} className="rounded-lg bg-cream p-4">
                  <button type="button" onClick={() => fillCard(item)} className="w-full text-left">
                    <h3 className="font-black text-cocoa">{item.name}</h3>
                    <p className="mt-1 text-sm font-bold text-truffle">
                      Rendimento: {(item.card?.yieldQuantity ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} un.
                      {item.card?.yieldWeightGrams ? ` | Receita: ${item.card.yieldWeightGrams}g` : ""}
                      {item.card?.unitWeightGrams ? ` | Unidade: ${item.card.unitWeightGrams}g` : ""}
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <span><strong className="block text-cocoa">{formatCurrency(item.costTotal)}</strong><span className="text-truffle">Receita</span></span>
                      <span><strong className="block text-cocoa">{formatCurrency(item.recipeCostPerUnit)}</strong><span className="text-truffle">Base un.</span></span>
                      <span><strong className="block text-cocoa">{formatCurrency(item.suggestedPrice)}</strong><span className="text-truffle">Sugerido</span></span>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "production" && (
        <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await send("production", { production }, "Producao registrada e ingredientes baixados.");
            }}
            className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft"
          >
            <h2 className="text-xl font-black text-cocoa">Registrar producao</h2>
            <p className="mt-2 text-sm leading-6 text-truffle">Ao produzir, o sistema baixa automaticamente os ingredientes da receita e aumenta o estoque do produto pronto.</p>
            <div className="mt-4 space-y-3">
              <select className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" value={production.productId} onChange={(event) => setProduction({ ...production, productId: Number(event.target.value) })}>
                {summary.products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Quantidade produzida" type="number" step="0.01" value={production.quantityProduced || ""} onChange={(event) => setProduction({ ...production, quantityProduced: Number(event.target.value) })} />
              <label className="block text-sm font-bold text-cocoa">Data da producao<input className="mt-1 w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" type="date" value={production.productionDate} onChange={(event) => setProduction({ ...production, productionDate: event.target.value })} /></label>
              <label className="block text-sm font-bold text-cocoa">Validade<input className="mt-1 w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" type="date" value={production.expiryDate} onChange={(event) => setProduction({ ...production, expiryDate: event.target.value })} /></label>
              <textarea className="min-h-24 w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Observacoes" value={production.notes} onChange={(event) => setProduction({ ...production, notes: event.target.value })} />
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cocoa px-5 py-3 font-black text-cream"><Save size={18} /> Registrar producao</button>
            </div>
          </form>

          <HistoryTable title="Historico de producao" rows={summary.productions} columns={[
            ["product_name", "Produto"],
            ["quantity_produced", "Qtd"],
            ["production_date", "Data"],
            ["expiry_date", "Validade"],
            ["total_cost", "Custo"]
          ]} currencyKeys={["total_cost"]} dateKeys={["production_date", "expiry_date"]} />
        </section>
      )}

      {tab === "sales" && (
        <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await send("sale", { sale }, "Venda registrada.");
            }}
            className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft"
          >
            <h2 className="text-xl font-black text-cocoa">Baixar produto vendido</h2>
            <p className="mt-2 text-sm leading-6 text-truffle">Use para registrar vendas manuais e reduzir o estoque pronto. Pedidos do delivery entram no painel de pedidos.</p>
            <div className="mt-4 space-y-3">
              <select className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" value={sale.productId} onChange={(event) => {
                const selected = summary.products.find((item) => item.id === Number(event.target.value));
                setSale({ ...sale, productId: Number(event.target.value), totalValue: (selected?.salePrice ?? 0) * sale.quantity });
              }}>
                {summary.products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Quantidade" type="number" step="1" value={sale.quantity || ""} onChange={(event) => setSale({ ...sale, quantity: Number(event.target.value), totalValue: (selectedSaleProduct?.salePrice ?? 0) * Number(event.target.value) })} />
                <input className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Valor total" type="number" step="0.01" value={sale.totalValue || ""} onChange={(event) => setSale({ ...sale, totalValue: Number(event.target.value) })} />
              </div>
              <label className="block text-sm font-bold text-cocoa">Data da venda<input className="mt-1 w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" type="date" value={sale.saleDate} onChange={(event) => setSale({ ...sale, saleDate: event.target.value })} /></label>
              <select className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" value={sale.paymentMethod} onChange={(event) => setSale({ ...sale, paymentMethod: event.target.value })}>
                <option>Pix</option>
                <option>Credito</option>
                <option>Debito</option>
                <option>Dinheiro</option>
              </select>
              <textarea className="min-h-24 w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Observacoes" value={sale.notes} onChange={(event) => setSale({ ...sale, notes: event.target.value })} />
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cocoa px-5 py-3 font-black text-cream"><Save size={18} /> Registrar venda</button>
            </div>
          </form>

          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-white/82 p-5 shadow-soft"><span className="font-bold text-truffle">Receita registrada</span><strong className="mt-1 block text-2xl text-cocoa">{formatCurrency(dashboard?.estimatedRevenue ?? 0)}</strong></div>
              <div className="rounded-lg bg-white/82 p-5 shadow-soft"><span className="font-bold text-truffle">Lucro estimado</span><strong className="mt-1 block text-2xl text-cocoa">{formatCurrency(dashboard?.estimatedProfit ?? 0)}</strong></div>
            </div>
            <HistoryTable title="Historico de vendas" rows={summary.sales} columns={[
              ["productName", "Produto"],
              ["quantity", "Qtd"],
              ["saleDate", "Data"],
              ["totalValue", "Valor"],
              ["estimatedProfit", "Lucro"],
              ["paymentMethod", "Pagamento"]
            ]} currencyKeys={["totalValue", "estimatedProfit"]} dateKeys={["saleDate"]} />
          </div>
        </section>
      )}

      {tab === "history" && (
        <section className="grid gap-5 lg:grid-cols-2">
          <HistoryTable title="Movimentacoes de estoque" rows={summary.movements} columns={[
            ["created_at", "Data"],
            ["type", "Tipo"],
            ["ingredient_name", "Ingrediente"],
            ["product_name", "Produto"],
            ["quantity", "Qtd"],
            ["total_cost", "Valor"]
          ]} currencyKeys={["total_cost"]} />
          <HistoryTable title="Producoes recentes" rows={summary.productions} columns={[
            ["product_name", "Produto"],
            ["quantity_produced", "Qtd"],
            ["production_date", "Data"],
            ["total_cost", "Custo"]
          ]} currencyKeys={["total_cost"]} dateKeys={["production_date"]} />
        </section>
      )}
    </main>
  );
}

function HistoryTable({
  title,
  rows,
  columns,
  currencyKeys = [],
  dateKeys = []
}: {
  title: string;
  rows: Record<string, unknown>[];
  columns: [string, string][];
  currencyKeys?: string[];
  dateKeys?: string[];
}) {
  return (
    <div className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft">
      <h2 className="text-xl font-black text-cocoa">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-lg bg-cream p-4 font-bold text-truffle">Ainda nao ha registros.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-cream text-cocoa">
              <tr>{columns.map(([, label]) => <th key={label} className="px-4 py-3">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-cocoa/10 bg-white">
              {rows.map((row, index) => (
                <tr key={asText(row.id) || index}>
                  {columns.map(([key]) => {
                    const value = row[key];
                    const display = currencyKeys.includes(key) ? formatCurrency(asNumber(value)) : dateKeys.includes(key) ? formatDate(value) : asText(value) || "-";
                    return <td key={key} className="px-4 py-3 text-truffle">{display}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
