import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { listInventorySummary } from "@/lib/inventory";
import { listOrders } from "@/lib/db";
import { onlyDigits } from "@/lib/format";

const dbPath = path.join(process.cwd(), "ibejinhos.sqlite");
const erpDb = new DatabaseSync(dbPath);

erpDb.exec("PRAGMA journal_mode = WAL");
erpDb.exec("PRAGMA busy_timeout = 5000");
erpDb.exec("PRAGMA foreign_keys = ON");

erpDb.exec(`
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

  CREATE TABLE IF NOT EXISTS delivery_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    courier_name TEXT NOT NULL,
    route_name TEXT NOT NULL,
    order_ids TEXT NOT NULL DEFAULT '[]',
    total_km REAL NOT NULL DEFAULT 0,
    estimated_minutes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'planejada',
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

erpDb.prepare("INSERT OR IGNORE INTO loyalty_rules (id) VALUES (1)").run();

function seedErp() {
  const expenseCount = erpDb.prepare("SELECT COUNT(*) as count FROM erp_expenses").get() as { count: number };
  if (expenseCount.count === 0) {
    const insert = erpDb.prepare(`
      INSERT INTO erp_expenses (name, category, amount, due_date, paid, recurring, type)
      VALUES (@name, @category, @amount, @dueDate, @paid, @recurring, @type)
    `);
    [
      ["Embalagens premium", "Insumos", 420, "2026-05-20", 0, 0, "variavel"],
      ["Anuncio Instagram", "Marketing", 180, "2026-05-22", 0, 1, "variavel"],
      ["Energia cozinha", "Operacao", 260, "2026-05-25", 1, 1, "fixa"],
      ["Motoboy sabados", "Entrega", 340, "2026-05-30", 0, 1, "variavel"]
    ].forEach(([name, category, amount, dueDate, paid, recurring, type]) => {
      insert.run({ name, category, amount, dueDate, paid, recurring, type });
    });
  }

  const receivableCount = erpDb.prepare("SELECT COUNT(*) as count FROM erp_receivables").get() as { count: number };
  if (receivableCount.count === 0) {
    erpDb.prepare(`
      INSERT INTO erp_receivables (customer_name, description, amount, due_date, received)
      VALUES ('Encomenda corporativa Moema', 'Caixas presenteaveis para evento', 780, '2026-05-24', 0)
    `).run();
  }

  const userCount = erpDb.prepare("SELECT COUNT(*) as count FROM app_users").get() as { count: number };
  if (userCount.count === 0) {
    const insertUser = erpDb.prepare("INSERT INTO app_users (name, email, role) VALUES (@name, @email, @role)");
    [
      ["Ibe", "admin@ibejinhos.com", "admin"],
      ["Producao", "producao@ibejinhos.com", "producao"],
      ["Entrega", "entrega@ibejinhos.com", "entrega"]
    ].forEach(([name, email, role]) => insertUser.run({ name, email, role }));
  }
}

seedErp();

type Row = Record<string, unknown>;

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

function sameMonth(dateText: string, now = new Date()) {
  const date = new Date(dateText);
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  return copy;
}

export function getErpSummary() {
  const orders = listOrders();
  const inventory = listInventorySummary();
  const expenses = erpDb.prepare("SELECT * FROM erp_expenses ORDER BY due_date ASC").all() as Row[];
  const receivables = erpDb.prepare("SELECT * FROM erp_receivables ORDER BY due_date ASC").all() as Row[];
  const users = erpDb.prepare("SELECT id, name, email, role, active, created_at FROM app_users ORDER BY role ASC, name ASC").all() as Row[];
  const auditLogs = erpDb.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 40").all() as Row[];
  const rules = erpDb.prepare("SELECT * FROM loyalty_rules WHERE id = 1").get() as Row;
  const now = new Date();
  const weekStart = startOfWeek(now);

  const paidExpenses = expenses.filter((item) => Boolean(item.paid));
  const openExpenses = expenses.filter((item) => !Boolean(item.paid));
  const openReceivables = receivables.filter((item) => !Boolean(item.received));
  const monthlyOrders = orders.filter((order) => sameMonth(order.createdAt, now));
  const weeklyOrders = orders.filter((order) => new Date(order.createdAt) >= weekStart);
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  const monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + order.total, 0);
  const weeklyRevenue = weeklyOrders.reduce((sum, order) => sum + order.total, 0);
  const paidExpenseTotal = paidExpenses.reduce((sum, item) => sum + number(item.amount), 0);
  const openExpenseTotal = openExpenses.reduce((sum, item) => sum + number(item.amount), 0);
  const receivableTotal = openReceivables.reduce((sum, item) => sum + number(item.amount), 0);
  const cogs = inventory.sales.reduce((sum, sale) => sum + (sale.totalValue - sale.estimatedProfit), 0);
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

  const pointsPerReal = number(rules.points_per_real) || 1;
  const vipThreshold = number(rules.vip_threshold_points) || 1200;
  const inactiveDays = number(rules.inactive_days) || 45;
  const customerSegments = Array.from(customers.values()).map((customer) => {
    const points = Math.floor(customer.totalSpent * pointsPerReal);
    const favorite = Array.from(customer.favorites.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    const inactiveForDays = daysBetween(new Date(customer.lastOrderAt), now);
    const segment = points >= vipThreshold ? "VIP" : inactiveForDays >= inactiveDays ? "Inativo" : customer.orders >= 3 ? "Recorrente" : "Novo";
    return {
      ...customer,
      favorites: favorite,
      averageTicket: customer.orders ? customer.totalSpent / customer.orders : 0,
      points,
      cashback: customer.totalSpent * (number(rules.cashback_percent) / 100),
      inactiveForDays,
      segment
    };
  }).sort((a, b) => b.totalSpent - a.totalSpent);

  const productProfit = inventory.products
    .map((product) => ({
      id: product.id,
      name: product.name,
      salePrice: product.salePrice,
      costPerUnit: product.costPerUnit,
      profitAmount: product.profitAmount,
      profitPercent: product.profitPercent,
      finishedStock: product.finishedStock,
      suggestedPrice: product.suggestedPrice
    }))
    .sort((a, b) => b.profitAmount - a.profitAmount);

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

  const lowStock = inventory.lowIngredients.map((item) => ({
    title: item.name,
    detail: `${item.currentQuantity} ${item.unit} em estoque, minimo ${item.minimumQuantity}`,
    action: "Comprar"
  }));
  const expiringSoon = inventory.ingredients.filter((item) => {
    if (!item.expiryDate) return false;
    const days = daysBetween(now, new Date(`${item.expiryDate}T23:59:59`));
    return days >= 0 && days <= 14;
  }).map((item) => ({
    title: item.name,
    detail: `Validade em ${item.expiryDate}`,
    action: "Usar primeiro"
  }));

  const demandSuggestions = inventory.topProducts.map((item) => ({
    productName: item.name,
    soldQuantity: item.quantity,
    suggestedProduction: Math.max(6, Math.ceil(item.quantity * 1.25)),
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
      activeCustomers: customerSegments.filter((customer) => customer.inactiveForDays < inactiveDays).length,
      inventoryValue: inventory.totalStockValue,
      openExpenses: openExpenseTotal,
      openReceivables: receivableTotal,
      pendingDeliveries: deliveryOrders.length
    },
    financial: {
      expenses: expenses.map((item) => ({
        id: number(item.id),
        name: text(item.name),
        category: text(item.category),
        amount: number(item.amount),
        dueDate: text(item.due_date),
        paid: Boolean(item.paid),
        recurring: Boolean(item.recurring),
        type: text(item.type)
      })),
      receivables: receivables.map((item) => ({
        id: number(item.id),
        customerName: text(item.customer_name),
        description: text(item.description),
        amount: number(item.amount),
        dueDate: text(item.due_date),
        received: Boolean(item.received)
      })),
      dre: [
        { label: "Receita bruta", amount: revenue },
        { label: "CMV estimado", amount: -cogs },
        { label: "Lucro bruto", amount: grossProfit },
        { label: "Despesas pagas", amount: -paidExpenseTotal },
        { label: "Lucro liquido", amount: netProfit }
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
      rules: {
        pointsPerReal,
        cashbackPercent: number(rules.cashback_percent),
        vipThresholdPoints: vipThreshold,
        inactiveDays
      },
      topCustomers: customerSegments.slice(0, 6)
    },
    marketing: {
      campaigns: [
        {
          name: "Recuperacao de inativos",
          channel: "WhatsApp",
          audience: customerSegments.filter((customer) => customer.segment === "Inativo").length,
          suggestion: "Enviar cupom VOLTAIBE com 10% para quem nao compra ha mais de 45 dias."
        },
        {
          name: "Aniversariantes",
          channel: "WhatsApp",
          audience: customerSegments.filter((customer) => customer.birthday).length,
          suggestion: "Oferecer brigadeiro cortesia no pedido da semana do aniversario."
        },
        {
          name: "VIP boutique",
          channel: "Instagram/WhatsApp",
          audience: customerSegments.filter((customer) => customer.segment === "VIP").length,
          suggestion: "Abrir pre-venda de kits premium antes do cardapio geral."
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
      reorderSuggestions: inventory.lowIngredients.map((item) => ({
        ingredientName: item.name,
        suggestedQuantity: Math.max(item.minimumQuantity * 2 - item.currentQuantity, item.minimumQuantity),
        supplier: item.supplier
      }))
    },
    admin: {
      users: users.map((item) => ({
        id: number(item.id),
        name: text(item.name),
        email: text(item.email),
        role: text(item.role),
        active: Boolean(item.active)
      })),
      auditLogs
    }
  };
}

export function createErpExpense(payload: { name: string; category: string; amount: number; dueDate: string; recurring?: boolean; type?: string }) {
  const data = {
    name: text(payload.name).trim(),
    category: text(payload.category).trim() || "Geral",
    amount: number(payload.amount),
    dueDate: text(payload.dueDate),
    recurring: payload.recurring ? 1 : 0,
    type: text(payload.type) || "variavel"
  };
  if (!data.name || data.amount <= 0 || !data.dueDate) throw new Error("Preencha despesa, valor e vencimento.");
  const result = erpDb.prepare(`
    INSERT INTO erp_expenses (name, category, amount, due_date, recurring, type)
    VALUES (@name, @category, @amount, @dueDate, @recurring, @type)
  `).run(data);
  logAudit("admin", "criou despesa", "erp_expenses", data.name);
  return Number(result.lastInsertRowid);
}

export function toggleExpensePaid(id: number, paid: boolean) {
  erpDb.prepare("UPDATE erp_expenses SET paid = @paid WHERE id = @id").run({ id, paid: paid ? 1 : 0 });
  logAudit("admin", paid ? "marcou despesa paga" : "reabriu despesa", "erp_expenses", String(id));
}

export function updateLoyaltyRules(payload: { pointsPerReal: number; cashbackPercent: number; vipThresholdPoints: number; inactiveDays: number }) {
  erpDb.prepare(`
    UPDATE loyalty_rules
    SET points_per_real = @pointsPerReal,
        cashback_percent = @cashbackPercent,
        vip_threshold_points = @vipThresholdPoints,
        inactive_days = @inactiveDays
    WHERE id = 1
  `).run({
    pointsPerReal: number(payload.pointsPerReal),
    cashbackPercent: number(payload.cashbackPercent),
    vipThresholdPoints: number(payload.vipThresholdPoints),
    inactiveDays: number(payload.inactiveDays)
  });
  logAudit("admin", "atualizou fidelidade", "loyalty_rules", "regras de pontos e cashback");
}

function logAudit(actor: string, action: string, entity: string, details: string) {
  erpDb.prepare(`
    INSERT INTO audit_logs (actor, action, entity, details)
    VALUES (@actor, @action, @entity, @details)
  `).run({ actor, action, entity, details });
}
