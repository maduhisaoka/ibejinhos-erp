import { prisma } from "@/lib/prisma";

type Row = Record<string, any>;

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function dateValue(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return textValue(value);
}

async function ensureInventorySeed() {
  const db = prisma as any;
  const count = await db.inventoryIngredient.count();
  if (count > 0) return;

  const leite = await db.inventoryIngredient.create({
    data: {
      name: "Leite condensado",
      unit: "unidade",
      currentQuantity: 36,
      minimumQuantity: 12,
      purchaseCost: 6.4,
      supplier: "Casa do Confeiteiro",
      lastPurchaseDate: "2026-05-10",
      expiryDate: "2026-11-20"
    }
  });
  const chocolate = await db.inventoryIngredient.create({
    data: {
      name: "Chocolate em pó 50%",
      unit: "g",
      currentQuantity: 5000,
      minimumQuantity: 1200,
      purchaseCost: 0.055,
      supplier: "Casa do Confeiteiro",
      lastPurchaseDate: "2026-05-09",
      expiryDate: "2027-01-15"
    }
  });
  const manteiga = await db.inventoryIngredient.create({
    data: {
      name: "Manteiga",
      unit: "g",
      currentQuantity: 1800,
      minimumQuantity: 500,
      purchaseCost: 0.048,
      supplier: "Mercado local",
      lastPurchaseDate: "2026-05-11",
      expiryDate: "2026-06-18"
    }
  });

  const brigadeiro = await db.inventoryProduct.create({
    data: {
      name: "Brigadeiro tradicional",
      category: "Docinhos",
      salePrice: 4.5,
      packagingName: "",
      packagingCost: 0,
      productionTime: "45 min",
      notes: "Produto base vendido por unidade ou em kits.",
      finishedStock: 80,
      trackFinishedStock: true,
      desiredMargin: 60
    }
  });

  const card = await db.technicalCard.create({
    data: {
      productId: brigadeiro.id,
      yieldQuantity: 30,
      yieldWeightGrams: 600,
      unitWeightGrams: 20,
      notes: "Ficha inicial para cálculo de custo do brigadeiro tradicional."
    }
  });

  await db.technicalCardItem.createMany({
    data: [
      { cardId: card.id, ingredientId: leite.id, quantity: 1 },
      { cardId: card.id, ingredientId: chocolate.id, quantity: 120 },
      { cardId: card.id, ingredientId: manteiga.id, quantity: 30 }
    ]
  });
}

function mapCard(card: Row | null) {
  if (!card) return null;

  const items = (card.items ?? []).map((item: Row) => {
    const quantity = numberValue(item.quantity);
    const unitCost = numberValue(item.ingredient?.purchaseCost);
    return {
      id: numberValue(item.id),
      ingredientId: numberValue(item.ingredientId),
      ingredientName: textValue(item.ingredient?.name),
      unit: textValue(item.ingredient?.unit),
      quantity,
      unitCost,
      proportionalCost: quantity * unitCost
    };
  });
  const yieldWeightGrams = numberValue(card.yieldWeightGrams);
  const unitWeightGrams = numberValue(card.unitWeightGrams);
  const yieldQuantity = Math.max(1, yieldWeightGrams > 0 && unitWeightGrams > 0 ? yieldWeightGrams / unitWeightGrams : numberValue(card.yieldQuantity));
  const costTotal = items.reduce((sum: number, item: Row) => sum + numberValue(item.proportionalCost), 0);
  const costPerUnit = costTotal / yieldQuantity;

  return {
    id: numberValue(card.id),
    productId: numberValue(card.productId),
    yieldQuantity,
    yieldWeightGrams,
    unitWeightGrams,
    notes: textValue(card.notes),
    items,
    costTotal,
    costPerUnit,
    suggestedPrice: costPerUnit * 1.6
  };
}

function mapProduct(product: Row) {
  const salePrice = numberValue(product.salePrice);
  const desiredMargin = numberValue(product.desiredMargin) || 60;
  const card = mapCard(product.card);
  const packagingCost = numberValue(product.packagingCost);
  const recipeCostPerUnit = card?.costPerUnit ?? 0;
  const costPerUnit = recipeCostPerUnit + packagingCost;
  const profitAmount = salePrice - costPerUnit;
  const profitPercent = salePrice > 0 ? (profitAmount / salePrice) * 100 : 0;
  const suggestedPrice = costPerUnit > 0 ? costPerUnit / (1 - desiredMargin / 100) : salePrice;

  return {
    id: numberValue(product.id),
    name: textValue(product.name),
    category: textValue(product.category),
    salePrice,
    packagingName: textValue(product.packagingName),
    packagingCost,
    productionTime: textValue(product.productionTime),
    notes: textValue(product.notes),
    finishedStock: numberValue(product.finishedStock),
    trackFinishedStock: Boolean(product.trackFinishedStock),
    desiredMargin,
    card,
    recipeCostPerUnit,
    costTotal: card?.costTotal ?? 0,
    costPerUnit,
    profitAmount,
    profitPercent,
    suggestedPrice
  };
}

export async function listPostgresInventorySummary() {
  const db = prisma as any;
  await ensureInventorySeed();

  const [ingredients, productRows, productions, sales, movements] = await Promise.all([
    db.inventoryIngredient.findMany({ orderBy: { name: "asc" } }),
    db.inventoryProduct.findMany({
      orderBy: { name: "asc" },
      include: { card: { include: { items: { include: { ingredient: true }, orderBy: { id: "asc" } } } } }
    }),
    db.production.findMany({ orderBy: [{ productionDate: "desc" }, { id: "desc" }], take: 80, include: { product: true } }),
    db.inventorySale.findMany({ orderBy: [{ saleDate: "desc" }, { id: "desc" }], take: 120, include: { product: true } }),
    db.stockMovement.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 120, include: { ingredient: true, product: true } })
  ]);

  const mappedIngredients = ingredients.map((item: Row) => ({
    id: numberValue(item.id),
    name: textValue(item.name),
    unit: textValue(item.unit),
    currentQuantity: numberValue(item.currentQuantity),
    minimumQuantity: numberValue(item.minimumQuantity),
    purchaseCost: numberValue(item.purchaseCost),
    supplier: textValue(item.supplier),
    lastPurchaseDate: textValue(item.lastPurchaseDate),
    expiryDate: textValue(item.expiryDate),
    createdAt: dateValue(item.createdAt)
  }));
  const products = productRows.map(mapProduct);
  const mappedSales = sales.map((sale: Row) => ({
    id: numberValue(sale.id),
    productId: numberValue(sale.productId),
    productName: textValue(sale.product?.name),
    quantity: numberValue(sale.quantity),
    saleDate: textValue(sale.saleDate),
    totalValue: numberValue(sale.totalValue),
    paymentMethod: textValue(sale.paymentMethod),
    notes: textValue(sale.notes),
    estimatedProfit: numberValue(sale.estimatedProfit),
    createdAt: dateValue(sale.createdAt)
  }));
  const salesByProduct = new Map<number, { productId: number; name: string; quantity: number; revenue: number }>();

  for (const sale of mappedSales) {
    const current = salesByProduct.get(sale.productId) ?? { productId: sale.productId, name: sale.productName, quantity: 0, revenue: 0 };
    current.quantity += sale.quantity;
    current.revenue += sale.totalValue;
    salesByProduct.set(sale.productId, current);
  }

  return {
    ingredients: mappedIngredients,
    products,
    productions: productions.map((item: Row) => ({ ...item, product_name: item.product?.name, productName: item.product?.name })),
    sales: mappedSales,
    movements: movements.map((item: Row) => ({ ...item, ingredient_name: item.ingredient?.name, product_name: item.product?.name, unit: item.ingredient?.unit })),
    totalStockValue: mappedIngredients.reduce((sum: number, item: Row) => sum + numberValue(item.currentQuantity) * numberValue(item.purchaseCost), 0),
    lowIngredients: mappedIngredients.filter((item: Row) => numberValue(item.currentQuantity) <= numberValue(item.minimumQuantity)),
    averageProductCost: products.length ? products.reduce((sum: number, item: Row) => sum + numberValue(item.costPerUnit), 0) / products.length : 0,
    topProducts: Array.from(salesByProduct.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5)
  };
}
