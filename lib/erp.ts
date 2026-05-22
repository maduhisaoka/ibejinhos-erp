import path from "node:path";
import { listOrders } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { onlyDigits } from "@/lib/format";

const usePostgres = Boolean(process.env.DATABASE_URL);

type Row = Record<string, unknown>;
type SqliteDb = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    all: (params?: Record<string, unknown>) => unknown[];
    get: (params?: Record<string, unknown>) => unknown;
    run: (params?: Record<string, unknown>) => { lastInsertRowid?: number | bigint };
  };
};
let sqliteDb: SqliteDb | null = null;

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bool(value: unknown) {
  return value === true || value === 1 || value === "1";
}

function dateText(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return text(value);
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

function sameMonth(dateValue: string, now = new Date()) {
  const date = new Date(dateValue);
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  return copy;
}

function getPrisma() {
  return prisma as any;
}

function getSqlite() {
  if (sqliteDb) return sqliteDb;
  const { DatabaseSync } = eval("require")("node:sqlite") as typeof import("node:sqlite");
  const dbPath = path.join(process.cwd(), "ibejinhos.sqlite");
  const db = new DatabaseSync(dbPath) as SqliteDb;

  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS erp_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      paid INTEGER NOT NULL DEFAULT 0,
      recurring INTEGER NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'fixa',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS erp_receivables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      received INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loyalty_rules (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      points_per_real REAL NOT NULL DEFAULT 1,
      cashback_percent REAL NOT NULL DEFAULT 3,
      vip_threshold_points INTEGER NOT NULL DEFAULT 1200,
      inactive_days INTEGER NOT NULL DEFAULT 45
    );

    CREATE TABLE IF NOT EXISTS app_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.prepare("INSERT OR IGNORE INTO loyalty_rules (id) VALUES (1)").run();
  seedSqliteErp(db);
  sqliteDb = db;
  return db;
}

function seedSqliteErp(db: SqliteDb) {
  const expenseCount = db.prepare("SELECT COUNT(*) as count FROM erp_expenses").get() as { count: number };
  if (expenseCount.count === 0) {
    const insert = db.prepare(`
      INSERT INTO erp_expenses (name, category, amount, due_date, paid, recurring, type)
      VALUES (@name, @category, @amount, @dueDate, @paid, @recurring, @type)
    `);
    [
      ["Embalagens premium", "Insumos", 420, "2026-05-20", 0, 0, "variavel"],
      ["Anúncio Instagram", "Marketing", 180, "2026-05-22", 0, 1, "variavel"],
      ["Energia da cozinha", "Operação", 260, "2026-05-25", 1, 1, "fixa"],
      ["Motoboy sábados", "Entrega", 340, "2026-05-30", 0, 1, "variavel"]
    ].forEach(([name, category, amount, dueDate, paid, recurring, type]) => {
      insert.run({ name, category, amount, dueDate, paid, recurring, type });
    });
  }

  const receivableCount = db.prepare("SELECT COUNT(*) as count FROM erp_receivables").get() as { count: number };
  if (receivableCount.count === 0) {
    db.prepare(`
      INSERT INTO erp_receivables (customer_name, description, amount, due_date, received)
      VALUES ('Encomenda corporativa Moema', 'Caixas presenteaveis para evento', 780, '2026-05-24', 0)
    `).run();
  }

  const userCount = db.prepare("SELECT COUNT(*) as count FROM app_users").get() as { count: number };
  if (userCount.count === 0) {
    const insertUser = db.prepare("INSERT INTO app_users (name, email, role) VALUES (@name, @email, @role)");
    [
      ["Ibe", "admin@ibejinhos.com", "admin"],
      ["Produção", "producao@ibejinhos.com", "producao"],
      ["Entrega", "entrega@ibejinhos.com", "entrega"]
    ].forEach(([name, email, role]) => insertUser.run({ name, email, role }));
  }
}

async function getErpRows() {
  if (usePostgres) {
    const prisma = getPrisma();
    const [expenses, receivables, users, auditLogs, rules] = await Promise.all([
      prisma.erpExpense.findMany({ orderBy: { dueDate: "asc" } }),
      prisma.erpReceivable.findMany({ orderBy: { dueDate: "asc" } }),
      prisma.appUser.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
      prisma.loyaltyRules.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, pointsPerReal: 1, cashbackPercent: 3, vipThresholdPoints: 1200, inactiveDays: 45 }
      })
    ]);
    return { expenses, receivables, users, auditLogs, rules };
  }

  const db = getSqlite();
  return {
    expenses: db.prepare("SELECT * FROM erp_expenses ORDER BY due_date ASC").all() as Row[],
    receivables: db.prepare("SELECT * FROM erp_receivables ORDER BY due_date ASC").all() as Row[],
    users: db.prepare("SELECT id, name, email, role, active, created_at FROM app_users ORDER BY role ASC, name ASC").all() as Row[],
    auditLogs: db.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 40").all() as Row[],
    rules: db.prepare("SELECT * FROM loyalty_rules WHERE id = 1").get() as Row
  };
}

async function getInventorySummary() {
  const empty = {
    ingredients: [],
    products: [],
    productions: [],
    sales: [],
    movements: [],
    totalStockValue: 0,
    lowIngredients: [],
    averageProductCost: 0,
    topProducts: []
  };

  if (usePostgres) {
    try {
      const { listPostgresInventorySummary } = await import("@/lib/inventoryPostgres");
      return await listPostgresInventorySummary();
    } catch (error) {
      console.error("Falha ao carregar estoque no ERP.", error);
      return empty;
    }
  }

  try {
    return eval("require")("./inventory").listInventorySummary();
  } catch {
    return empty;
  }
}

function field(row: Row, camel: string, snake = camel) {
  return row[camel] ?? row[snake];
}

function normalizeExpense(item: Row) {
  return {
    id: number(field(item, "id")),
    name: text(field(item, "name")),
    category: text(field(item, "category")),
    amount: number(field(item, "amount")),
    dueDate: text(field(item, "dueDate", "due_date")),
    paid: bool(field(item, "paid")),
    recurring: bool(field(item, "recurring")),
    type: text(field(item, "type")) || "fixa"
  };
}

function normalizeReceivable(item: Row) {
  return {
    id: number(field(item, "id")),
    customerName: text(field(item, "customerName", "customer_name")),
    description: text(field(item, "description")),
    amount: number(field(item, "amount")),
    dueDate: text(field(item, "dueDate", "due_date")),
    received: bool(field(item, "received"))
  };
}

function normalizeRules(item: Row) {
  return {
    pointsPerReal: number(field(item, "pointsPerReal", "points_per_real")) || 1,
    cashbackPercent: number(field(item, "cashbackPercent", "cashback_percent")) || 3,
    vipThresholdPoints: number(field(item, "vipThresholdPoints", "vip_threshold_points")) || 1200,
    inactiveDays: number(field(item, "inactiveDays", "inactive_days")) || 45
  };
}

export async function getErpSummary() {
  const [orders, inventory, rows] = await Promise.all([listOrders(), getInventorySummary(), getErpRows()]);
  const expenses = (rows.expenses as Row[]).map(normalizeExpense);
  const receivables = (rows.receivables as Row[]).map(normalizeReceivable);
  const rules = normalizeRules(rows.rules as Row);
  const now = new Date();
  const weekStart = startOfWeek(now);

  const paidExpenses = expenses.filter((item) => item.paid);
  const openExpenses = expenses.filter((item) => !item.paid);
  const openReceivables = receivables.filter((item) => !item.received);
  const monthlyOrders = orders.filter((order) => sameMonth(order.createdAt, now));
  const weeklyOrders = orders.filter((order) => new Date(order.createdAt) >= weekStart);
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  const monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + order.total, 0);
  const weeklyRevenue = weeklyOrders.reduce((sum, order) => sum + order.total, 0);
  const paidExpenseTotal = paidExpenses.reduce((sum, item) => sum + item.amount, 0);
  const openExpenseTotal = openExpenses.reduce((sum, item) => sum + item.amount, 0);
  const receivableTotal = openReceivables.reduce((sum, item) => sum + item.amount, 0);
  const cogs = inventory.sales.reduce((sum: number, sale: Row) => sum + (number(sale.totalValue) - number(sale.estimatedProfit)), 0);
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - paidExpenseTotal;

  const customers = new Map<string, {
    key: string;
    name: string;
    whatsapp: string;
    email: string;
    birthday: string;
    orders: number;
    totalSpent: number;
    lastOrderAt: string;
    favorites: Map<string, number>;
  }>();

  for (const order of orders) {
    const key = onlyDigits(order.cpf) || onlyDigits(order.whatsapp) || order.customerName.toLowerCase();
    const current = customers.get(key) ?? {
      key,
      name: order.customerName,
      whatsapp: order.whatsapp,
      email: order.email,
      birthday: order.birthdayDay && order.birthdayMonth ? `${String(order.birthdayDay).padStart(2, "0")}/${String(order.birthdayMonth).padStart(2, "0")}` : "",
      orders: 0,
      totalSpent: 0,
      lastOrderAt: order.createdAt,
      favorites: new Map<string, number>()
    };
    current.orders += 1;
    current.totalSpent += order.total;
    if (new Date(order.createdAt) > new Date(current.lastOrderAt)) current.lastOrderAt = order.createdAt;
    for (const item of order.items) {
      current.favorites.set(item.name, (current.favorites.get(item.name) ?? 0) + item.quantity);
    }
    customers.set(key, current);
  }

  const customerSegments = Array.from(customers.values()).map((customer) => {
    const points = Math.floor(customer.totalSpent * rules.pointsPerReal);
    const favorite = Array.from(customer.favorites.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    const inactiveForDays = daysBetween(new Date(customer.lastOrderAt), now);
    const segment = points >= rules.vipThresholdPoints ? "VIP" : inactiveForDays >= rules.inactiveDays ? "Inativo" : customer.orders >= 3 ? "Recorrente" : "Novo";
    return {
      ...customer,
      favorites: favorite,
      averageTicket: customer.orders ? customer.totalSpent / customer.orders : 0,
      points,
      cashback: customer.totalSpent * (rules.cashbackPercent / 100),
      inactiveForDays,
      segment
    };
  }).sort((a, b) => b.totalSpent - a.totalSpent);

  const productProfit = inventory.products
    .map((product: Row) => ({
      id: number(product.id),
      name: text(product.name),
      salePrice: number(product.salePrice),
      costPerUnit: number(product.costPerUnit),
      profitAmount: number(product.profitAmount),
      profitPercent: number(product.profitPercent),
      finishedStock: number(product.finishedStock),
      suggestedPrice: number(product.suggestedPrice)
    }))
    .sort((a: Row, b: Row) => number(b.profitAmount) - number(a.profitAmount));

  const deliveryOrders = orders.filter((order) => !order.delivered);
  const deliveryKm = deliveryOrders.reduce((sum, order) => sum + (order.deliveryDistanceKm ?? 0), 0);
  const deliveryBatches = Array.from(new Set(deliveryOrders.map((order) => order.neighborhood))).map((neighborhood) => {
    const neighborhoodOrders = deliveryOrders.filter((order) => order.neighborhood === neighborhood);
    return {
      neighborhood,
      orders: neighborhoodOrders.length,
      total: neighborhoodOrders.reduce((sum, order) => sum + order.total, 0),
      km: neighborhoodOrders.reduce((sum, order) => sum + (order.deliveryDistanceKm ?? 0), 0)
    };
  });

  const lowStock = inventory.lowIngredients.map((item: Row) => ({
    title: text(item.name),
    detail: `${number(item.currentQuantity)} ${text(item.unit)} em estoque, mínimo ${number(item.minimumQuantity)}`,
    action: "Comprar"
  }));
  const expiringSoon = inventory.ingredients.filter((item: Row) => {
    if (!item.expiryDate) return false;
    const days = daysBetween(now, new Date(`${item.expiryDate}T23:59:59`));
    return days >= 0 && days <= 14;
  }).map((item: Row) => ({
    title: text(item.name),
    detail: `Validade em ${text(item.expiryDate)}`,
    action: "Usar primeiro"
  }));
  const demandSuggestions = inventory.topProducts.map((item: Row) => ({
    productName: text(item.name),
    soldQuantity: number(item.quantity),
    suggestedProduction: Math.max(6, Math.ceil(number(item.quantity) * 1.25)),
    reason: "Baseado nas vendas registradas"
  }));

  return {
    kpis: {
      revenue,
      weeklyRevenue,
      monthlyRevenue,
      grossProfit,
      netProfit,
      cogs,
      margin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
      orders: orders.length,
      activeCustomers: customerSegments.filter((customer) => customer.inactiveForDays < rules.inactiveDays).length,
      inventoryValue: number(inventory.totalStockValue),
      openExpenses: openExpenseTotal,
      openReceivables: receivableTotal,
      pendingDeliveries: deliveryOrders.length
    },
    financial: {
      expenses,
      receivables,
      dre: [
        { label: "Receita bruta", amount: revenue },
        { label: "CMV estimado", amount: -cogs },
        { label: "Lucro bruto", amount: grossProfit },
        { label: "Despesas pagas", amount: -paidExpenseTotal },
        { label: "Lucro líquido", amount: netProfit }
      ]
    },
    crm: {
      customers: customerSegments,
      vip: customerSegments.filter((customer) => customer.segment === "VIP"),
      inactive: customerSegments.filter((customer) => customer.segment === "Inativo"),
      recurring: customerSegments.filter((customer) => customer.segment === "Recorrente"),
      birthdays: customerSegments.filter((customer) => customer.birthday)
    },
    loyalty: {
      rules,
      topCustomers: customerSegments.slice(0, 6)
    },
    marketing: {
      campaigns: [
        {
          name: "Recuperação de inativos",
          channel: "WhatsApp",
          audience: customerSegments.filter((customer) => customer.segment === "Inativo").length,
          suggestion: "Enviar cupom VOLTAIBE com 10% para quem não compra há mais de 45 dias."
        },
        {
          name: "Aniversariantes",
          channel: "WhatsApp",
          audience: customerSegments.filter((customer) => customer.birthday).length,
          suggestion: "Oferecer brigadeiro cortesia no pedido da semana do aniversário."
        },
        {
          name: "VIP boutique",
          channel: "Instagram/WhatsApp",
          audience: customerSegments.filter((customer) => customer.segment === "VIP").length,
          suggestion: "Abrir pré-venda de kits premium antes do cardápio geral."
        }
      ]
    },
    delivery: {
      pendingOrders: deliveryOrders,
      batches: deliveryBatches,
      totalKm: deliveryKm,
      estimatedMinutes: Math.ceil(deliveryKm * 7 + deliveryOrders.length * 8)
    },
    intelligence: {
      alerts: [...lowStock, ...expiringSoon],
      productProfit,
      demandSuggestions,
      reorderSuggestions: inventory.lowIngredients.map((item: Row) => ({
        ingredientName: text(item.name),
        suggestedQuantity: Math.max(number(item.minimumQuantity) * 2 - number(item.currentQuantity), number(item.minimumQuantity)),
        supplier: text(item.supplier)
      }))
    },
    admin: {
      users: (rows.users as Row[]).map((item) => ({
        id: number(field(item, "id")),
        name: text(field(item, "name")),
        email: text(field(item, "email")),
        role: text(field(item, "role")),
        active: bool(field(item, "active"))
      })),
      auditLogs: (rows.auditLogs as Row[]).map((item) => ({
        id: number(field(item, "id")),
        actor: text(field(item, "actor")),
        action: text(field(item, "action")),
        entity: text(field(item, "entity")),
        details: text(field(item, "details")),
        createdAt: dateText(field(item, "createdAt", "created_at"))
      }))
    }
  };
}

export async function createErpExpense(payload: { name: string; category: string; amount: number; dueDate: string; recurring?: boolean; type?: string }) {
  const data = {
    name: text(payload.name).trim(),
    category: text(payload.category).trim() || "Geral",
    amount: number(payload.amount),
    dueDate: text(payload.dueDate),
    recurring: Boolean(payload.recurring),
    type: text(payload.type) || "variavel"
  };
  if (!data.name || data.amount <= 0 || !data.dueDate) throw new Error("Preencha despesa, valor e vencimento.");

  if (usePostgres) {
    const created = await getPrisma().erpExpense.create({ data });
    await logAudit("admin", "criou despesa", "erp_expenses", data.name);
    return created.id;
  }

  const result = getSqlite().prepare(`
    INSERT INTO erp_expenses (name, category, amount, due_date, recurring, type)
    VALUES (@name, @category, @amount, @dueDate, @recurring, @type)
  `).run({ ...data, recurring: data.recurring ? 1 : 0 });
  await logAudit("admin", "criou despesa", "erp_expenses", data.name);
  return Number(result.lastInsertRowid);
}

export async function toggleExpensePaid(id: number, paid: boolean) {
  if (usePostgres) {
    await getPrisma().erpExpense.update({ where: { id }, data: { paid } });
  } else {
    getSqlite().prepare("UPDATE erp_expenses SET paid = @paid WHERE id = @id").run({ id, paid: paid ? 1 : 0 });
  }
  await logAudit("admin", paid ? "marcou despesa paga" : "reabriu despesa", "erp_expenses", String(id));
}

export async function updateLoyaltyRules(payload: { pointsPerReal: number; cashbackPercent: number; vipThresholdPoints: number; inactiveDays: number }) {
  const data = {
    pointsPerReal: number(payload.pointsPerReal),
    cashbackPercent: number(payload.cashbackPercent),
    vipThresholdPoints: number(payload.vipThresholdPoints),
    inactiveDays: number(payload.inactiveDays)
  };

  if (usePostgres) {
    await getPrisma().loyaltyRules.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  } else {
    getSqlite().prepare(`
      UPDATE loyalty_rules
      SET points_per_real = @pointsPerReal,
          cashback_percent = @cashbackPercent,
          vip_threshold_points = @vipThresholdPoints,
          inactive_days = @inactiveDays
      WHERE id = 1
    `).run(data);
  }
  await logAudit("admin", "atualizou fidelidade", "loyalty_rules", "regras de pontos e cashback");
}

async function logAudit(actor: string, action: string, entity: string, details: string) {
  if (usePostgres) {
    await getPrisma().auditLog.create({ data: { actor, action, entity, details } });
    return;
  }
  getSqlite().prepare(`
    INSERT INTO audit_logs (actor, action, entity, details)
    VALUES (@actor, @action, @entity, @details)
  `).run({ actor, action, entity, details });
}
