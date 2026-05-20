import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const dbPath = path.join(process.cwd(), "ibejinhos.sqlite");
const inventoryDb = new DatabaseSync(dbPath);

inventoryDb.exec("PRAGMA journal_mode = WAL");
inventoryDb.exec("PRAGMA busy_timeout = 5000");
inventoryDb.exec("PRAGMA foreign_keys = ON");

inventoryDb.exec(`
  CREATE TABLE IF NOT EXISTS inventory_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    current_quantity REAL NOT NULL DEFAULT 0,
    minimum_quantity REAL NOT NULL DEFAULT 0,
    purchase_cost REAL NOT NULL DEFAULT 0,
    supplier TEXT,
    last_purchase_date TEXT,
    expiry_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    sale_price REAL NOT NULL DEFAULT 0,
    packaging_name TEXT,
    packaging_cost REAL NOT NULL DEFAULT 0,
    production_time TEXT,
    notes TEXT,
    finished_stock REAL NOT NULL DEFAULT 0,
    track_finished_stock INTEGER NOT NULL DEFAULT 1,
    desired_margin REAL NOT NULL DEFAULT 60,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS technical_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL UNIQUE,
    packaging_name TEXT,
    packaging_cost REAL NOT NULL DEFAULT 0,
    yield_quantity REAL NOT NULL DEFAULT 1,
    yield_weight_grams REAL NOT NULL DEFAULT 0,
    unit_weight_grams REAL NOT NULL DEFAULT 0,
    notes TEXT,
    FOREIGN KEY (product_id) REFERENCES inventory_products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS technical_card_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL,
    ingredient_id INTEGER NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (card_id) REFERENCES technical_cards(id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_id) REFERENCES inventory_ingredients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_id INTEGER,
    product_id INTEGER,
    type TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0,
    total_cost REAL NOT NULL DEFAULT 0,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ingredient_id) REFERENCES inventory_ingredients(id) ON DELETE SET NULL,
    FOREIGN KEY (product_id) REFERENCES inventory_products(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS productions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    quantity_produced REAL NOT NULL,
    production_date TEXT NOT NULL,
    expiry_date TEXT,
    notes TEXT,
    total_cost REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES inventory_products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS inventory_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    sale_date TEXT NOT NULL,
    total_value REAL NOT NULL,
    payment_method TEXT NOT NULL,
    notes TEXT,
    estimated_profit REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES inventory_products(id) ON DELETE CASCADE
  );
`);

const productColumns = inventoryDb.prepare("PRAGMA table_info(inventory_products)").all() as { name: string }[];
const productColumnNames = new Set(productColumns.map((column) => column.name));
if (!productColumnNames.has("packaging_name")) {
  inventoryDb.exec("ALTER TABLE inventory_products ADD COLUMN packaging_name TEXT");
}
if (!productColumnNames.has("packaging_cost")) {
  inventoryDb.exec("ALTER TABLE inventory_products ADD COLUMN packaging_cost REAL NOT NULL DEFAULT 0");
}

const cardColumns = inventoryDb.prepare("PRAGMA table_info(technical_cards)").all() as { name: string }[];
const cardColumnNames = new Set(cardColumns.map((column) => column.name));
if (!cardColumnNames.has("yield_weight_grams")) {
  inventoryDb.exec("ALTER TABLE technical_cards ADD COLUMN yield_weight_grams REAL NOT NULL DEFAULT 0");
}
if (!cardColumnNames.has("unit_weight_grams")) {
  inventoryDb.exec("ALTER TABLE technical_cards ADD COLUMN unit_weight_grams REAL NOT NULL DEFAULT 0");
}

inventoryDb.prepare(`
  UPDATE inventory_products
  SET packaging_name = (
      SELECT packaging_name FROM technical_cards WHERE technical_cards.product_id = inventory_products.id
    ),
    packaging_cost = (
      SELECT packaging_cost FROM technical_cards WHERE technical_cards.product_id = inventory_products.id
    )
  WHERE COALESCE(packaging_cost, 0) = 0
    AND EXISTS (
      SELECT 1 FROM technical_cards
      WHERE technical_cards.product_id = inventory_products.id
        AND COALESCE(technical_cards.packaging_cost, 0) > 0
    )
`).run();

type Row = Record<string, unknown>;

export type InventoryIngredient = {
  id: number;
  name: string;
  unit: string;
  currentQuantity: number;
  minimumQuantity: number;
  purchaseCost: number;
  supplier: string;
  lastPurchaseDate: string;
  expiryDate: string;
  createdAt: string;
};

export type InventoryProduct = {
  id: number;
  name: string;
  category: string;
  salePrice: number;
  packagingName: string;
  packagingCost: number;
  productionTime: string;
  notes: string;
  finishedStock: number;
  trackFinishedStock: boolean;
  desiredMargin: number;
  card: TechnicalCard | null;
  recipeCostPerUnit: number;
  costTotal: number;
  costPerUnit: number;
  profitAmount: number;
  profitPercent: number;
  suggestedPrice: number;
};

export type TechnicalCard = {
  id: number;
  productId: number;
  yieldQuantity: number;
  yieldWeightGrams: number;
  unitWeightGrams: number;
  notes: string;
  items: TechnicalCardItem[];
  costTotal: number;
  costPerUnit: number;
  suggestedPrice: number;
};

export type TechnicalCardItem = {
  id: number;
  ingredientId: number;
  ingredientName: string;
  unit: string;
  quantity: number;
  unitCost: number;
  proportionalCost: number;
};

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function mapIngredient(row: Row): InventoryIngredient {
  return {
    id: numberValue(row.id),
    name: textValue(row.name),
    unit: textValue(row.unit),
    currentQuantity: numberValue(row.current_quantity),
    minimumQuantity: numberValue(row.minimum_quantity),
    purchaseCost: numberValue(row.purchase_cost),
    supplier: textValue(row.supplier),
    lastPurchaseDate: textValue(row.last_purchase_date),
    expiryDate: textValue(row.expiry_date),
    createdAt: textValue(row.created_at)
  };
}

function getCard(productId: number): TechnicalCard | null {
  const cardRow = inventoryDb.prepare("SELECT * FROM technical_cards WHERE product_id = @productId").get({ productId }) as Row | undefined;
  if (!cardRow) return null;

  const items = inventoryDb
    .prepare(`
      SELECT tci.id, tci.ingredient_id, tci.quantity, ing.name, ing.unit, ing.purchase_cost
      FROM technical_card_items tci
      JOIN inventory_ingredients ing ON ing.id = tci.ingredient_id
      WHERE tci.card_id = @cardId
      ORDER BY ing.name ASC
    `)
    .all({ cardId: numberValue(cardRow.id) }) as Row[];

  const mappedItems: TechnicalCardItem[] = items.map((item) => {
    const quantity = numberValue(item.quantity);
    const unitCost = numberValue(item.purchase_cost);
    return {
      id: numberValue(item.id),
      ingredientId: numberValue(item.ingredient_id),
      ingredientName: textValue(item.name),
      unit: textValue(item.unit),
      quantity,
      unitCost,
      proportionalCost: quantity * unitCost
    };
  });

  const yieldWeightGrams = numberValue(cardRow.yield_weight_grams);
  const unitWeightGrams = numberValue(cardRow.unit_weight_grams);
  const yieldQuantity = Math.max(
    1,
    yieldWeightGrams > 0 && unitWeightGrams > 0 ? yieldWeightGrams / unitWeightGrams : numberValue(cardRow.yield_quantity)
  );
  const costTotal = mappedItems.reduce((sum, item) => sum + item.proportionalCost, 0);
  const costPerUnit = costTotal / yieldQuantity;

  return {
    id: numberValue(cardRow.id),
    productId,
    yieldQuantity,
    yieldWeightGrams,
    unitWeightGrams,
    notes: textValue(cardRow.notes),
    items: mappedItems,
    costTotal,
    costPerUnit,
    suggestedPrice: costPerUnit * 1.6
  };
}

function mapProduct(row: Row): InventoryProduct {
  const salePrice = numberValue(row.sale_price);
  const desiredMargin = numberValue(row.desired_margin) || 60;
  const card = getCard(numberValue(row.id));
  const packagingCost = numberValue(row.packaging_cost);
  const recipeCostPerUnit = card?.costPerUnit ?? 0;
  const costPerUnit = recipeCostPerUnit + packagingCost;
  const profitAmount = salePrice - costPerUnit;
  const profitPercent = salePrice > 0 ? (profitAmount / salePrice) * 100 : 0;
  const suggestedPrice = costPerUnit > 0 ? costPerUnit / (1 - desiredMargin / 100) : salePrice;

  return {
    id: numberValue(row.id),
    name: textValue(row.name),
    category: textValue(row.category),
    salePrice,
    packagingName: textValue(row.packaging_name),
    packagingCost,
    productionTime: textValue(row.production_time),
    notes: textValue(row.notes),
    finishedStock: numberValue(row.finished_stock),
    trackFinishedStock: Boolean(row.track_finished_stock),
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

function seedInventory() {
  const ingredientCount = inventoryDb.prepare("SELECT COUNT(*) as count FROM inventory_ingredients").get() as { count: number };
  if (ingredientCount.count > 0) return;

  inventoryDb.exec("BEGIN");
  try {
    const insertIngredient = inventoryDb.prepare(`
      INSERT INTO inventory_ingredients
        (name, unit, current_quantity, minimum_quantity, purchase_cost, supplier, last_purchase_date, expiry_date)
      VALUES (@name, @unit, @currentQuantity, @minimumQuantity, @purchaseCost, @supplier, @lastPurchaseDate, @expiryDate)
    `);

    const ingredients = [
      ["Leite condensado", "unidade", 36, 12, 6.4, "Atacadao", "2026-05-10", "2026-11-20"],
      ["Chocolate em po 50%", "g", 5000, 1200, 0.055, "Casa do Confeiteiro", "2026-05-09", "2027-01-15"],
      ["Manteiga", "g", 1800, 500, 0.048, "Mercado local", "2026-05-11", "2026-06-18"],
      ["Granulado belga", "g", 3200, 900, 0.082, "Doce Distribuidora", "2026-05-08", "2027-03-01"],
      ["Embalagem caixa 9 doces", "unidade", 42, 15, 3.2, "Embalagens Bela", "2026-05-07", ""],
      ["Pote copo felicidade", "unidade", 55, 20, 2.1, "Embalagens Bela", "2026-05-07", ""],
      ["Massa de bolo chocolate", "kg", 8, 2, 18.5, "Produção própria", "2026-05-12", "2026-05-22"],
      ["Creme de ninho", "kg", 5, 1.5, 26, "Produção própria", "2026-05-12", "2026-05-20"]
    ];

    for (const item of ingredients) {
      insertIngredient.run({
        name: item[0],
        unit: item[1],
        currentQuantity: item[2],
        minimumQuantity: item[3],
        purchaseCost: item[4],
        supplier: item[5],
        lastPurchaseDate: item[6],
        expiryDate: item[7]
      });
    }

    const insertProduct = inventoryDb.prepare(`
      INSERT INTO inventory_products
        (name, category, sale_price, packaging_name, packaging_cost, production_time, notes, finished_stock, track_finished_stock, desired_margin)
      VALUES (@name, @category, @salePrice, @packagingName, @packagingCost, @productionTime, @notes, @finishedStock, @trackFinishedStock, @desiredMargin)
    `);

    const products = [
      ["Brigadeiro gourmet", "Docinhos", 4.5, "Forminha", 0.18, "45 min", "Unidade enrolada com granulado belga.", 64, 1, 62],
      ["Caixa de brigadeiros", "Kits", 42, "Caixa 9 doces", 3.2, "1h20", "Caixa com 9 unidades sortidas.", 14, 1, 58],
      ["Bolo gelado", "Bolos", 16, "Embalagem individual", 0.9, "2h", "Fatia embalada individualmente.", 22, 1, 55],
      ["Bolo de brigadeiro 1kg", "Bolos", 120, "Base e caixa de bolo", 8.5, "3h", "Bolo sob encomenda.", 3, 1, 60],
      ["Copo da felicidade", "Sobremesas", 24, "Pote com tampa", 2.1, "50 min", "Camadas de bolo, creme e brigadeiro.", 18, 1, 57]
    ];

    const productIds: number[] = [];
    for (const product of products) {
      const result = insertProduct.run({
        name: product[0],
        category: product[1],
        salePrice: product[2],
        packagingName: product[3],
        packagingCost: product[4],
        productionTime: product[5],
        notes: product[6],
        finishedStock: product[7],
        trackFinishedStock: product[8],
        desiredMargin: product[9]
      });
      productIds.push(Number(result.lastInsertRowid));
    }

    const ingredientByName = new Map(
      (inventoryDb.prepare("SELECT id, name FROM inventory_ingredients").all() as { id: number; name: string }[]).map((item) => [item.name, item.id])
    );
    const insertCard = inventoryDb.prepare(`
      INSERT INTO technical_cards (product_id, packaging_name, packaging_cost, yield_quantity, yield_weight_grams, unit_weight_grams, notes)
      VALUES (@productId, '', 0, @yieldQuantity, @yieldWeightGrams, @unitWeightGrams, @notes)
    `);
    const insertItem = inventoryDb.prepare(`
      INSERT INTO technical_card_items (card_id, ingredient_id, quantity)
      VALUES (@cardId, @ingredientId, @quantity)
    `);

    const cards = [
      {
        productId: productIds[0],
        yieldQuantity: 25,
        yieldWeightGrams: 450,
        unitWeightGrams: 18,
        items: [["Leite condensado", 1], ["Chocolate em po 50%", 90], ["Manteiga", 20], ["Granulado belga", 180]]
      },
      {
        productId: productIds[1],
        yieldQuantity: 1,
        yieldWeightGrams: 0,
        unitWeightGrams: 0,
        items: [["Leite condensado", 0.45], ["Chocolate em po 50%", 40], ["Manteiga", 9], ["Granulado belga", 75]]
      },
      {
        productId: productIds[2],
        yieldQuantity: 12,
        yieldWeightGrams: 0,
        unitWeightGrams: 0,
        items: [["Massa de bolo chocolate", 1.2], ["Creme de ninho", 0.8], ["Chocolate em po 50%", 160]]
      },
      {
        productId: productIds[3],
        yieldQuantity: 1,
        yieldWeightGrams: 0,
        unitWeightGrams: 0,
        items: [["Massa de bolo chocolate", 1.6], ["Leite condensado", 2], ["Chocolate em po 50%", 220], ["Manteiga", 60]]
      },
      {
        productId: productIds[4],
        yieldQuantity: 8,
        yieldWeightGrams: 0,
        unitWeightGrams: 0,
        items: [["Massa de bolo chocolate", 1], ["Creme de ninho", 1.2], ["Leite condensado", 1]]
      }
    ];

    for (const card of cards) {
      const cardId = Number(insertCard.run({
        productId: Number(card.productId),
        yieldQuantity: Number(card.yieldQuantity),
        yieldWeightGrams: Number(card.yieldWeightGrams),
        unitWeightGrams: Number(card.unitWeightGrams),
        notes: ""
      }).lastInsertRowid);
      for (const [ingredientName, quantity] of card.items) {
        const ingredientId = ingredientByName.get(String(ingredientName));
        if (ingredientId) {
          insertItem.run({ cardId, ingredientId, quantity: Number(quantity) });
        }
      }
    }

    inventoryDb.exec("COMMIT");
  } catch (error) {
    inventoryDb.exec("ROLLBACK");
    throw error;
  }
}

seedInventory();

export function listInventorySummary() {
  const ingredients = listIngredients();
  const products = listInventoryProducts();
  const productions = listProductions();
  const sales = listInventorySales();
  const movements = listStockMovements();
  const totalStockValue = ingredients.reduce((sum, item) => sum + item.currentQuantity * item.purchaseCost, 0);
  const lowIngredients = ingredients.filter((item) => item.currentQuantity <= item.minimumQuantity);
  const averageProductCost = products.length ? products.reduce((sum, item) => sum + item.costPerUnit, 0) / products.length : 0;
  const salesByProduct = new Map<number, { productId: number; name: string; quantity: number; revenue: number }>();

  for (const sale of sales) {
    const current = salesByProduct.get(sale.productId) ?? { productId: sale.productId, name: sale.productName, quantity: 0, revenue: 0 };
    current.quantity += sale.quantity;
    current.revenue += sale.totalValue;
    salesByProduct.set(sale.productId, current);
  }

  return {
    ingredients,
    products,
    productions,
    sales,
    movements,
    totalStockValue,
    lowIngredients,
    averageProductCost,
    topProducts: Array.from(salesByProduct.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5)
  };
}

export function listIngredients() {
  const rows = inventoryDb.prepare("SELECT * FROM inventory_ingredients ORDER BY name ASC").all() as Row[];
  return rows.map(mapIngredient);
}

export function upsertIngredient(payload: Partial<InventoryIngredient>) {
  const data = {
    id: numberValue(payload.id),
    name: textValue(payload.name).trim(),
    unit: textValue(payload.unit).trim(),
    currentQuantity: numberValue(payload.currentQuantity),
    minimumQuantity: numberValue(payload.minimumQuantity),
    purchaseCost: numberValue(payload.purchaseCost),
    supplier: textValue(payload.supplier).trim(),
    lastPurchaseDate: textValue(payload.lastPurchaseDate),
    expiryDate: textValue(payload.expiryDate)
  };

  if (!data.name || !data.unit) {
    throw new Error("Preencha nome e unidade do ingrediente.");
  }

  if (data.id) {
    inventoryDb.prepare(`
      UPDATE inventory_ingredients
      SET name = @name, unit = @unit, current_quantity = @currentQuantity, minimum_quantity = @minimumQuantity,
          purchase_cost = @purchaseCost, supplier = @supplier, last_purchase_date = @lastPurchaseDate, expiry_date = @expiryDate
      WHERE id = @id
    `).run(data);
    return data.id;
  }

  const insertData = {
    name: data.name,
    unit: data.unit,
    currentQuantity: data.currentQuantity,
    minimumQuantity: data.minimumQuantity,
    purchaseCost: data.purchaseCost,
    supplier: data.supplier,
    lastPurchaseDate: data.lastPurchaseDate,
    expiryDate: data.expiryDate
  };

  const result = inventoryDb.prepare(`
    INSERT INTO inventory_ingredients
      (name, unit, current_quantity, minimum_quantity, purchase_cost, supplier, last_purchase_date, expiry_date)
    VALUES (@name, @unit, @currentQuantity, @minimumQuantity, @purchaseCost, @supplier, @lastPurchaseDate, @expiryDate)
  `).run(insertData);
  return Number(result.lastInsertRowid);
}

export function deleteIngredient(id: number) {
  inventoryDb.prepare("DELETE FROM inventory_ingredients WHERE id = @id").run({ id });
}

export function addIngredientEntry(payload: { ingredientId: number; quantity: number; unitCost: number; supplier?: string; lastPurchaseDate?: string; expiryDate?: string; note?: string }) {
  const ingredient = inventoryDb.prepare("SELECT * FROM inventory_ingredients WHERE id = @id").get({ id: payload.ingredientId }) as Row | undefined;
  if (!ingredient) throw new Error("Ingrediente não encontrado.");
  const quantity = numberValue(payload.quantity);
  const unitCost = numberValue(payload.unitCost) || numberValue(ingredient.purchase_cost);
  if (quantity <= 0) throw new Error("Informe uma quantidade de entrada maior que zero.");

  inventoryDb.exec("BEGIN");
  try {
    inventoryDb.prepare(`
      UPDATE inventory_ingredients
      SET current_quantity = current_quantity + @quantity,
          purchase_cost = @unitCost,
          supplier = COALESCE(NULLIF(@supplier, ''), supplier),
          last_purchase_date = COALESCE(NULLIF(@lastPurchaseDate, ''), last_purchase_date),
          expiry_date = COALESCE(NULLIF(@expiryDate, ''), expiry_date)
      WHERE id = @ingredientId
    `).run({
      ingredientId: payload.ingredientId,
      quantity,
      unitCost,
      supplier: payload.supplier ?? "",
      lastPurchaseDate: payload.lastPurchaseDate ?? "",
      expiryDate: payload.expiryDate ?? ""
    });

    inventoryDb.prepare(`
      INSERT INTO stock_movements (ingredient_id, type, quantity, unit_cost, total_cost, note)
      VALUES (@ingredientId, 'entrada', @quantity, @unitCost, @totalCost, @note)
    `).run({ ingredientId: payload.ingredientId, quantity, unitCost, totalCost: quantity * unitCost, note: payload.note ?? "Entrada manual" });
    inventoryDb.exec("COMMIT");
  } catch (error) {
    inventoryDb.exec("ROLLBACK");
    throw error;
  }
}

export function listInventoryProducts() {
  const rows = inventoryDb.prepare("SELECT * FROM inventory_products ORDER BY name ASC").all() as Row[];
  return rows.map(mapProduct);
}

export function upsertInventoryProduct(payload: Partial<InventoryProduct>) {
  const data = {
    id: numberValue(payload.id),
    name: textValue(payload.name).trim(),
    category: textValue(payload.category).trim(),
    salePrice: numberValue(payload.salePrice),
    packagingName: textValue(payload.packagingName).trim(),
    packagingCost: numberValue(payload.packagingCost),
    productionTime: textValue(payload.productionTime).trim(),
    notes: textValue(payload.notes).trim(),
    finishedStock: numberValue(payload.finishedStock),
    trackFinishedStock: payload.trackFinishedStock === false ? 0 : 1,
    desiredMargin: numberValue(payload.desiredMargin) || 60
  };

  if (!data.name || !data.category) {
    throw new Error("Preencha nome e categoria do produto.");
  }

  if (data.id) {
    inventoryDb.prepare(`
      UPDATE inventory_products
      SET name = @name, category = @category, sale_price = @salePrice,
          packaging_name = @packagingName, packaging_cost = @packagingCost, production_time = @productionTime,
          notes = @notes, finished_stock = @finishedStock, track_finished_stock = @trackFinishedStock, desired_margin = @desiredMargin
      WHERE id = @id
    `).run(data);
    return data.id;
  }

  const insertData = {
    name: data.name,
    category: data.category,
    salePrice: data.salePrice,
    packagingName: data.packagingName,
    packagingCost: data.packagingCost,
    productionTime: data.productionTime,
    notes: data.notes,
    finishedStock: data.finishedStock,
    trackFinishedStock: data.trackFinishedStock,
    desiredMargin: data.desiredMargin
  };

  const result = inventoryDb.prepare(`
    INSERT INTO inventory_products
      (name, category, sale_price, packaging_name, packaging_cost, production_time, notes, finished_stock, track_finished_stock, desired_margin)
    VALUES (@name, @category, @salePrice, @packagingName, @packagingCost, @productionTime, @notes, @finishedStock, @trackFinishedStock, @desiredMargin)
  `).run(insertData);
  return Number(result.lastInsertRowid);
}

export function deleteInventoryProduct(id: number) {
  inventoryDb.prepare("DELETE FROM inventory_products WHERE id = @id").run({ id });
}

export function deleteTechnicalCard(productId: number) {
  if (!productId) throw new Error("Produto inválido.");
  inventoryDb.prepare("DELETE FROM technical_cards WHERE product_id = @productId").run({ productId });
}

export function upsertTechnicalCard(payload: {
  productId: number;
  yieldQuantity: number;
  yieldWeightGrams?: number;
  unitWeightGrams?: number;
  notes?: string;
  items: { ingredientId: number; quantity: number }[];
}) {
  if (!payload.productId) throw new Error("Produto inválido.");
  const yieldWeightGrams = numberValue(payload.yieldWeightGrams);
  const unitWeightGrams = numberValue(payload.unitWeightGrams);
  const calculatedYield = yieldWeightGrams > 0 && unitWeightGrams > 0 ? yieldWeightGrams / unitWeightGrams : numberValue(payload.yieldQuantity);
  if (calculatedYield <= 0) throw new Error("Informe o rendimento da receita.");

  inventoryDb.exec("BEGIN");
  try {
    const existing = inventoryDb.prepare("SELECT id FROM technical_cards WHERE product_id = @productId").get({ productId: payload.productId }) as { id: number } | undefined;
    const cardData = {
      productId: payload.productId,
      yieldQuantity: calculatedYield,
      yieldWeightGrams,
      unitWeightGrams,
      notes: textValue(payload.notes)
    };
    let cardId = existing?.id;

    if (cardId) {
      inventoryDb.prepare(`
        UPDATE technical_cards
        SET yield_quantity = @yieldQuantity, yield_weight_grams = @yieldWeightGrams,
            unit_weight_grams = @unitWeightGrams, notes = @notes
        WHERE id = @id
      `).run({ ...cardData, id: cardId });
      inventoryDb.prepare("DELETE FROM technical_card_items WHERE card_id = @cardId").run({ cardId });
    } else {
      cardId = Number(inventoryDb.prepare(`
        INSERT INTO technical_cards (product_id, packaging_name, packaging_cost, yield_quantity, yield_weight_grams, unit_weight_grams, notes)
        VALUES (@productId, '', 0, @yieldQuantity, @yieldWeightGrams, @unitWeightGrams, @notes)
      `).run(cardData).lastInsertRowid);
    }

    const insertItem = inventoryDb.prepare(`
      INSERT INTO technical_card_items (card_id, ingredient_id, quantity)
      VALUES (@cardId, @ingredientId, @quantity)
    `);
    for (const item of payload.items) {
      const ingredientId = numberValue(item.ingredientId);
      const quantity = numberValue(item.quantity);
      if (ingredientId && quantity > 0) {
        insertItem.run({ cardId, ingredientId, quantity });
      }
    }

    inventoryDb.exec("COMMIT");
    return cardId;
  } catch (error) {
    inventoryDb.exec("ROLLBACK");
    throw error;
  }
}

export function registerProduction(payload: { productId: number; quantityProduced: number; productionDate: string; expiryDate?: string; notes?: string }) {
  const product = mapProduct(inventoryDb.prepare("SELECT * FROM inventory_products WHERE id = @id").get({ id: payload.productId }) as Row);
  if (!product.card) throw new Error("Cadastre a ficha técnica antes de produzir.");
  const quantityProduced = numberValue(payload.quantityProduced);
  if (quantityProduced <= 0) throw new Error("Informe uma quantidade produzida maior que zero.");
  const multiplier = quantityProduced / product.card.yieldQuantity;

  inventoryDb.exec("BEGIN");
  try {
    for (const item of product.card.items) {
      const requiredQuantity = item.quantity * multiplier;
      const current = inventoryDb.prepare("SELECT current_quantity FROM inventory_ingredients WHERE id = @id").get({ id: item.ingredientId }) as { current_quantity: number };
      if (numberValue(current.current_quantity) < requiredQuantity) {
        throw new Error(`Estoque insuficiente para ${item.ingredientName}.`);
      }
      inventoryDb.prepare("UPDATE inventory_ingredients SET current_quantity = current_quantity - @quantity WHERE id = @ingredientId").run({
        ingredientId: item.ingredientId,
        quantity: requiredQuantity
      });
      inventoryDb.prepare(`
        INSERT INTO stock_movements (ingredient_id, product_id, type, quantity, unit_cost, total_cost, note)
        VALUES (@ingredientId, @productId, 'producao', @quantity, @unitCost, @totalCost, @note)
      `).run({
        ingredientId: item.ingredientId,
        productId: product.id,
        quantity: -requiredQuantity,
        unitCost: item.unitCost,
        totalCost: -(requiredQuantity * item.unitCost),
        note: `Produção de ${quantityProduced} ${product.name}`
      });
    }

    const totalCost = product.recipeCostPerUnit * quantityProduced;
    inventoryDb.prepare("UPDATE inventory_products SET finished_stock = finished_stock + @quantityProduced WHERE id = @productId").run({
      productId: product.id,
      quantityProduced
    });
    inventoryDb.prepare(`
      INSERT INTO productions (product_id, quantity_produced, production_date, expiry_date, notes, total_cost)
      VALUES (@productId, @quantityProduced, @productionDate, @expiryDate, @notes, @totalCost)
    `).run({
      productId: product.id,
      quantityProduced,
      productionDate: payload.productionDate,
      expiryDate: payload.expiryDate ?? "",
      notes: payload.notes ?? "",
      totalCost
    });
    inventoryDb.exec("COMMIT");
  } catch (error) {
    inventoryDb.exec("ROLLBACK");
    throw error;
  }
}

export function registerInventorySale(payload: { productId: number; quantity: number; saleDate: string; totalValue: number; paymentMethod: string; notes?: string }) {
  const product = mapProduct(inventoryDb.prepare("SELECT * FROM inventory_products WHERE id = @id").get({ id: payload.productId }) as Row);
  const quantity = numberValue(payload.quantity);
  if (quantity <= 0) throw new Error("Informe uma quantidade vendida maior que zero.");
  if (product.trackFinishedStock && product.finishedStock < quantity) throw new Error("Estoque de produto finalizado insuficiente.");

  inventoryDb.exec("BEGIN");
  try {
    if (product.trackFinishedStock) {
      inventoryDb.prepare("UPDATE inventory_products SET finished_stock = finished_stock - @quantity WHERE id = @productId").run({
        productId: product.id,
        quantity
      });
    }
    const totalValue = numberValue(payload.totalValue) || product.salePrice * quantity;
    const estimatedProfit = totalValue - product.costPerUnit * quantity;
    inventoryDb.prepare(`
      INSERT INTO inventory_sales (product_id, quantity, sale_date, total_value, payment_method, notes, estimated_profit)
      VALUES (@productId, @quantity, @saleDate, @totalValue, @paymentMethod, @notes, @estimatedProfit)
    `).run({
      productId: product.id,
      quantity,
      saleDate: payload.saleDate,
      totalValue,
      paymentMethod: textValue(payload.paymentMethod) || "Pix",
      notes: textValue(payload.notes),
      estimatedProfit
    });
    inventoryDb.exec("COMMIT");
  } catch (error) {
    inventoryDb.exec("ROLLBACK");
    throw error;
  }
}

export function listProductions() {
  return inventoryDb.prepare(`
    SELECT prod.*, p.name as product_name
    FROM productions prod
    JOIN inventory_products p ON p.id = prod.product_id
    ORDER BY prod.production_date DESC, prod.id DESC
    LIMIT 80
  `).all() as Row[];
}

export function listInventorySales() {
  const rows = inventoryDb.prepare(`
    SELECT s.*, p.name as product_name
    FROM inventory_sales s
    JOIN inventory_products p ON p.id = s.product_id
    ORDER BY s.sale_date DESC, s.id DESC
    LIMIT 120
  `).all() as Row[];

  return rows.map((row) => ({
    id: numberValue(row.id),
    productId: numberValue(row.product_id),
    productName: textValue(row.product_name),
    quantity: numberValue(row.quantity),
    saleDate: textValue(row.sale_date),
    totalValue: numberValue(row.total_value),
    paymentMethod: textValue(row.payment_method),
    notes: textValue(row.notes),
    estimatedProfit: numberValue(row.estimated_profit),
    createdAt: textValue(row.created_at)
  }));
}

export function listStockMovements() {
  return inventoryDb.prepare(`
    SELECT m.*, ing.name as ingredient_name, ing.unit as unit, p.name as product_name
    FROM stock_movements m
    LEFT JOIN inventory_ingredients ing ON ing.id = m.ingredient_id
    LEFT JOIN inventory_products p ON p.id = m.product_id
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 120
  `).all() as Row[];
}
