import path from "node:path";
import { seedProducts } from "@/lib/products";
import { normalizeCpf, onlyDigits } from "@/lib/format";
import type { CartItem, LoyaltySummary, Order, OrderStatus, PaymentMethod, Product, RegisteredCustomer, StoreSettings } from "@/lib/types";

type Row = Record<string, unknown>;
type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    all(params?: Record<string, unknown>): Row[];
    get(params?: Record<string, unknown>): Row | undefined;
    run(params?: Record<string, unknown>): { lastInsertRowid?: number | bigint };
  };
};

const usePostgres = Boolean(process.env.DATABASE_URL);
let sqliteDb: SqliteDatabase | null = null;
let prismaClient: any = null;

function getPrisma() {
  if (!prismaClient) {
    const { PrismaClient } = eval("require")("@prisma/client");
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

function getSqlite() {
  if (sqliteDb) return sqliteDb;
  const { DatabaseSync } = eval("require")("node:sqlite");
  const dbPath = path.join(process.cwd(), "ibejinhos.sqlite");
  const db = new DatabaseSync(dbPath) as SqliteDatabase;

  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL,
      image TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      flavor_limit INTEGER NOT NULL DEFAULT 0,
      flavors TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT,
      customer_name TEXT NOT NULL,
      cpf TEXT,
      whatsapp TEXT NOT NULL,
      email TEXT,
      birthday_day INTEGER,
      birthday_month INTEGER,
      registration_street TEXT,
      registration_number TEXT,
      registration_complement TEXT,
      registration_neighborhood TEXT,
      registration_cep TEXT,
      delivery_same_as_registration INTEGER NOT NULL DEFAULT 1,
      recipient_name TEXT,
      address TEXT,
      street TEXT,
      number TEXT,
      complement TEXT,
      neighborhood TEXT NOT NULL,
      cep TEXT NOT NULL,
      items TEXT NOT NULL,
      subtotal REAL NOT NULL,
      delivery_distance_km REAL,
      delivery_fee REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      loyalty_order_count INTEGER NOT NULL DEFAULT 1,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      receipt_path TEXT,
      status TEXT NOT NULL DEFAULT 'preparando',
      delivered INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cpf TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      email TEXT,
      whatsapp TEXT NOT NULL,
      birthday_day INTEGER,
      birthday_month INTEGER,
      street TEXT NOT NULL,
      number TEXT NOT NULL,
      complement TEXT,
      neighborhood TEXT NOT NULL,
      cep TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS store_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      minimum_order_value REAL NOT NULL DEFAULT 0
    );
  `);

  db.prepare("INSERT OR IGNORE INTO store_settings (id, minimum_order_value) VALUES (1, 0)").run();

  const productCount = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number } | undefined;
  if (Number(productCount?.count ?? 0) === 0) {
    const insert = db.prepare(`
      INSERT INTO products (name, description, price, image, active, flavor_limit, flavors)
      VALUES (@name, @description, @price, @image, @active, @flavorLimit, @flavors)
    `);
    db.exec("BEGIN");
    try {
      for (const product of seedProducts) {
        insert.run({ ...product, active: product.active ? 1 : 0, flavors: JSON.stringify(product.flavors) });
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  sqliteDb = db;
  return db;
}

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (!value) return [];
  try {
    return JSON.parse(String(value)) as string[];
  } catch {
    return [];
  }
}

function parseItems(value: unknown) {
  if (Array.isArray(value)) return value as CartItem[];
  try {
    return JSON.parse(String(value || "[]")) as CartItem[];
  } catch {
    return [];
  }
}

function mapProduct(row: Row): Product {
  return {
    id: Number(row.id),
    name: String(row.name),
    description: String(row.description),
    price: Number(row.price),
    image: String(row.image),
    active: Boolean(row.active),
    flavorLimit: Number(row.flavorLimit ?? row.flavor_limit ?? 0),
    flavors: parseJsonArray(row.flavors)
  };
}

function mapOrder(row: Row): Order {
  return {
    id: Number(row.id),
    orderNumber: String(row.orderNumber ?? row.order_number ?? `IBJ-${String(row.id).padStart(5, "0")}`),
    customerName: String(row.customerName ?? row.customer_name),
    cpf: String(row.cpf ?? ""),
    whatsapp: String(row.whatsapp),
    email: String(row.email ?? ""),
    birthdayDay: row.birthdayDay === null || row.birthday_day === null ? null : Number(row.birthdayDay ?? row.birthday_day ?? 0) || null,
    birthdayMonth: row.birthdayMonth === null || row.birthday_month === null ? null : Number(row.birthdayMonth ?? row.birthday_month ?? 0) || null,
    registrationStreet: String(row.registrationStreet ?? row.registration_street ?? row.street ?? row.address ?? ""),
    registrationNumber: String(row.registrationNumber ?? row.registration_number ?? row.number ?? ""),
    registrationComplement: String(row.registrationComplement ?? row.registration_complement ?? ""),
    registrationNeighborhood: String(row.registrationNeighborhood ?? row.registration_neighborhood ?? row.neighborhood ?? ""),
    registrationCep: String(row.registrationCep ?? row.registration_cep ?? row.cep ?? ""),
    deliverySameAsRegistration: Boolean(row.deliverySameAsRegistration ?? row.delivery_same_as_registration ?? true),
    recipientName: String(row.recipientName ?? row.recipient_name ?? ""),
    street: String(row.street ?? row.address ?? ""),
    number: String(row.number ?? ""),
    complement: String(row.complement ?? ""),
    neighborhood: String(row.neighborhood),
    cep: String(row.cep),
    items: parseItems(row.items),
    subtotal: Number(row.subtotal),
    deliveryDistanceKm: row.deliveryDistanceKm === null || row.delivery_distance_km === null ? null : Number(row.deliveryDistanceKm ?? row.delivery_distance_km ?? 0),
    deliveryFee: Number(row.deliveryFee ?? row.delivery_fee),
    discount: Number(row.discount ?? 0),
    loyaltyOrderCount: Number(row.loyaltyOrderCount ?? row.loyalty_order_count ?? 1),
    total: Number(row.total),
    paymentMethod: String(row.paymentMethod ?? row.payment_method) as PaymentMethod,
    receiptPath: row.receiptPath || row.receipt_path ? String(row.receiptPath ?? row.receipt_path) : null,
    status: String(row.status ?? "preparando") as OrderStatus,
    delivered: Boolean(row.delivered ?? false),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? row.created_at)
  };
}

function mapCustomer(row: Row): RegisteredCustomer {
  return {
    id: Number(row.id),
    name: String(row.name),
    cpf: String(row.cpf),
    whatsapp: String(row.whatsapp),
    email: String(row.email ?? ""),
    birthdayDay: row.birthdayDay === null || row.birthday_day === null ? null : Number(row.birthdayDay ?? row.birthday_day ?? 0) || null,
    birthdayMonth: row.birthdayMonth === null || row.birthday_month === null ? null : Number(row.birthdayMonth ?? row.birthday_month ?? 0) || null,
    street: String(row.street),
    number: String(row.number),
    complement: String(row.complement ?? ""),
    neighborhood: String(row.neighborhood),
    cep: String(row.cep),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? row.created_at)
  };
}

function serializeOrderItems(items: CartItem[]) {
  return JSON.stringify(items.map((item) => ({ ...item, selectedFlavors: item.selectedFlavors ?? {} })));
}

export async function listProducts(includeInactive = false) {
  if (usePostgres) {
    const rows = await getPrisma().product.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: { id: "asc" }
    });
    return (rows as Row[]).map(mapProduct);
  }

  const rows = getSqlite()
    .prepare(includeInactive ? "SELECT * FROM products ORDER BY id ASC" : "SELECT * FROM products WHERE active = 1 ORDER BY id ASC")
    .all();
  return rows.map(mapProduct);
}

export async function upsertProduct(product: Partial<Product> & Omit<Product, "id"> & { id?: number }) {
  if (usePostgres) {
    const data = {
      name: product.name,
      description: product.description,
      price: product.price,
      image: product.image,
      active: product.active,
      flavorLimit: product.flavorLimit ?? 0,
      flavors: product.flavors ?? []
    };
    const row = product.id
      ? await getPrisma().product.update({ where: { id: product.id }, data })
      : await getPrisma().product.create({ data });
    return Number(row.id);
  }

  const db = getSqlite();
  if (product.id) {
    db.prepare(`
      UPDATE products
      SET name = @name, description = @description, price = @price, image = @image,
          active = @active, flavor_limit = @flavorLimit, flavors = @flavors
      WHERE id = @id
    `).run({ ...product, active: product.active ? 1 : 0, flavors: JSON.stringify(product.flavors ?? []) });
    return product.id;
  }

  const result = db
    .prepare(`
      INSERT INTO products (name, description, price, image, active, flavor_limit, flavors)
      VALUES (@name, @description, @price, @image, @active, @flavorLimit, @flavors)
    `)
    .run({ ...product, active: product.active ? 1 : 0, flavors: JSON.stringify(product.flavors ?? []) });
  return Number(result.lastInsertRowid);
}

export async function createOrder(order: Omit<Order, "id" | "createdAt">) {
  if (usePostgres) {
    const row = await getPrisma().order.create({
      data: {
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        cpf: order.cpf,
        whatsapp: order.whatsapp,
        email: order.email,
        birthdayDay: order.birthdayDay,
        birthdayMonth: order.birthdayMonth,
        registrationStreet: order.registrationStreet,
        registrationNumber: order.registrationNumber,
        registrationComplement: order.registrationComplement,
        registrationNeighborhood: order.registrationNeighborhood,
        registrationCep: order.registrationCep,
        deliverySameAsRegistration: order.deliverySameAsRegistration,
        recipientName: order.recipientName,
        address: order.street,
        street: order.street,
        number: order.number,
        complement: order.complement,
        neighborhood: order.neighborhood,
        cep: order.cep,
        items: order.items,
        subtotal: order.subtotal,
        deliveryDistanceKm: order.deliveryDistanceKm,
        deliveryFee: order.deliveryFee,
        discount: order.discount,
        loyaltyOrderCount: order.loyaltyOrderCount,
        total: order.total,
        paymentMethod: order.paymentMethod,
        receiptPath: order.receiptPath,
        status: order.status,
        delivered: order.delivered
      }
    });
    return Number(row.id);
  }

  const result = getSqlite()
    .prepare(`
      INSERT INTO orders (
        order_number, customer_name, cpf, whatsapp, email, birthday_day, birthday_month,
        registration_street, registration_number, registration_complement, registration_neighborhood, registration_cep,
        delivery_same_as_registration, recipient_name, address, street, number, complement,
        neighborhood, cep, items, subtotal, delivery_distance_km, delivery_fee, discount,
        loyalty_order_count, total, payment_method, receipt_path, status, delivered
      )
      VALUES (
        @orderNumber, @customerName, @cpf, @whatsapp, @email, @birthdayDay, @birthdayMonth,
        @registrationStreet, @registrationNumber, @registrationComplement, @registrationNeighborhood, @registrationCep,
        @deliverySameAsRegistration, @recipientName, @street, @street, @number, @complement,
        @neighborhood, @cep, @items, @subtotal, @deliveryDistanceKm, @deliveryFee, @discount,
        @loyaltyOrderCount, @total, @paymentMethod, @receiptPath, @status, @delivered
      )
    `)
    .run({ ...order, deliverySameAsRegistration: order.deliverySameAsRegistration ? 1 : 0, delivered: order.delivered ? 1 : 0, items: serializeOrderItems(order.items) });
  return Number(result.lastInsertRowid);
}

export async function listOrders() {
  if (usePostgres) {
    const rows = await getPrisma().order.findMany({ orderBy: { id: "desc" } });
    return (rows as Row[]).map(mapOrder);
  }
  return getSqlite().prepare("SELECT * FROM orders ORDER BY id DESC").all().map(mapOrder);
}

export async function countCustomerOrders(customerKey: string) {
  const digits = onlyDigits(customerKey);
  if (!digits) return 0;
  const orders = await listOrders();
  return orders.filter((row: Order) => onlyDigits(row.cpf ?? "") === digits || onlyDigits(row.whatsapp) === digits).length;
}

export async function getLoyaltySummary(customerKey: string): Promise<LoyaltySummary> {
  const previousOrders = await countCustomerOrders(customerKey);
  const cycleOrderCount = previousOrders % 10;
  const qualifiesForDiscount = previousOrders > 0 && cycleOrderCount === 0;
  const nextCycleOrderCount = qualifiesForDiscount ? 0 : cycleOrderCount + 1;
  return {
    previousOrders,
    currentOrderCount: qualifiesForDiscount ? 10 : nextCycleOrderCount,
    cycleOrderCount: qualifiesForDiscount ? 10 : cycleOrderCount,
    nextCycleOrderCount,
    qualifiesForDiscount,
    ordersUntilDiscount: qualifiesForDiscount ? 0 : Math.max(0, 10 - cycleOrderCount),
    discountRate: qualifiesForDiscount ? 0.1 : 0,
    rewardLabel: "Cartao Doce Ibejinhos",
    rewardDescription: "A cada 10 pedidos, o proximo pedido recebe 10% de desconto. Depois de usar o mimo, a contagem recomeça."
  };
}

export function makeOrderNumber(id: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const prefix = alphabet[id % alphabet.length];
  const checksum = (id * 7 + 13) % 97;
  return `${prefix}${String(id).padStart(4, "0")}${String(checksum).padStart(2, "0")}`;
}

export async function updateOrderNumber(id: number, orderNumber: string) {
  if (usePostgres) return getPrisma().order.update({ where: { id }, data: { orderNumber } });
  getSqlite().prepare("UPDATE orders SET order_number = @orderNumber WHERE id = @id").run({ id, orderNumber });
}

export async function updateOrderReceipt(id: number, receiptPath: string) {
  if (usePostgres) return getPrisma().order.update({ where: { id }, data: { receiptPath, status: "finalizado" } });
  getSqlite().prepare("UPDATE orders SET receipt_path = @receiptPath, status = 'finalizado' WHERE id = @id").run({ id, receiptPath });
}

export async function updateOrderStatus(id: number, status: OrderStatus) {
  if (usePostgres) return getPrisma().order.update({ where: { id }, data: { status } });
  getSqlite().prepare("UPDATE orders SET status = @status WHERE id = @id").run({ id, status });
}

export async function updateOrderDelivered(id: number, delivered: boolean) {
  if (usePostgres) return getPrisma().order.update({ where: { id }, data: { delivered } });
  getSqlite().prepare("UPDATE orders SET delivered = @delivered WHERE id = @id").run({ id, delivered: delivered ? 1 : 0 });
}

export async function deleteOrder(id: number) {
  if (usePostgres) return getPrisma().order.delete({ where: { id } });
  getSqlite().prepare("DELETE FROM orders WHERE id = @id").run({ id });
}

export async function listOrdersByCpf(cpf: string) {
  const normalized = normalizeCpf(cpf);
  if (!normalized) return [];
  const orders = await listOrders();
  return orders.filter((order) => normalizeCpf(order.cpf) === normalized);
}

export async function getStoreSettings(): Promise<StoreSettings> {
  if (usePostgres) {
    const row = await getPrisma().storeSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, minimumOrderValue: 0 } });
    return { minimumOrderValue: Number(row.minimumOrderValue ?? 0) };
  }
  const row = getSqlite().prepare("SELECT minimum_order_value FROM store_settings WHERE id = 1").get() as { minimum_order_value?: number } | undefined;
  return { minimumOrderValue: Number(row?.minimum_order_value ?? 0) };
}

export async function updateStoreSettings(settings: StoreSettings) {
  if (usePostgres) return getPrisma().storeSettings.upsert({ where: { id: 1 }, update: settings, create: { id: 1, ...settings } });
  getSqlite().prepare("UPDATE store_settings SET minimum_order_value = @minimumOrderValue WHERE id = 1").run(settings);
}

export async function upsertCustomer(customer: {
  name: string;
  cpf: string;
  password: string;
  email: string;
  whatsapp: string;
  birthdayDay: number | null;
  birthdayMonth: number | null;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  cep: string;
}) {
  if (usePostgres) {
    const row = await getPrisma().customer.upsert({ where: { cpf: customer.cpf }, update: customer, create: customer });
    return Number(row.id);
  }
  const db = getSqlite();
  const existing = db.prepare("SELECT id FROM customers WHERE cpf = @cpf").get({ cpf: customer.cpf }) as { id?: number } | undefined;
  if (existing) {
    db.prepare(`
      UPDATE customers
      SET name = @name, password = @password, email = @email, whatsapp = @whatsapp, birthday_day = @birthdayDay, birthday_month = @birthdayMonth,
          street = @street, number = @number, complement = @complement, neighborhood = @neighborhood, cep = @cep
      WHERE cpf = @cpf
    `).run(customer);
    return Number(existing.id);
  }
  const result = db.prepare(`
    INSERT INTO customers (name, cpf, password, email, whatsapp, birthday_day, birthday_month, street, number, complement, neighborhood, cep)
    VALUES (@name, @cpf, @password, @email, @whatsapp, @birthdayDay, @birthdayMonth, @street, @number, @complement, @neighborhood, @cep)
  `).run(customer);
  return Number(result.lastInsertRowid);
}

export async function listCustomers() {
  if (usePostgres) {
    const rows = await getPrisma().customer.findMany({ orderBy: { createdAt: "desc" } });
    return (rows as Row[]).map(mapCustomer);
  }
  return getSqlite().prepare("SELECT * FROM customers ORDER BY created_at DESC").all().map(mapCustomer);
}

export async function deleteCustomer(id: number) {
  if (usePostgres) return getPrisma().customer.delete({ where: { id } });
  getSqlite().prepare("DELETE FROM customers WHERE id = @id").run({ id });
}

export async function getCustomerByCpf(cpf: string) {
  if (usePostgres) {
    const row = await getPrisma().customer.findUnique({ where: { cpf: normalizeCpf(cpf) } });
    return row ? mapCustomer(row) : null;
  }
  const row = getSqlite().prepare("SELECT * FROM customers WHERE cpf = @cpf").get({ cpf: normalizeCpf(cpf) });
  return row ? mapCustomer(row) : null;
}

export async function verifyCustomerPassword(cpf: string, password: string) {
  if (usePostgres) {
    const row = await getPrisma().customer.findUnique({ where: { cpf: normalizeCpf(cpf) }, select: { password: true } });
    return Boolean(row && row.password === password);
  }
  const row = getSqlite().prepare("SELECT password FROM customers WHERE cpf = @cpf").get({ cpf: normalizeCpf(cpf) }) as { password?: string } | undefined;
  return Boolean(row && row.password === password);
}

export async function resetCustomerPassword(cpf: string, email: string, password: string) {
  if (usePostgres) {
    const row = await getPrisma().customer.findFirst({ where: { cpf: normalizeCpf(cpf), email: { equals: email.trim(), mode: "insensitive" } } });
    if (!row) return false;
    await getPrisma().customer.update({ where: { id: row.id }, data: { password } });
    return true;
  }
  const row = getSqlite().prepare("SELECT id FROM customers WHERE cpf = @cpf AND lower(email) = lower(@email)").get({ cpf: normalizeCpf(cpf), email: email.trim() }) as { id?: number } | undefined;
  if (!row) return false;
  getSqlite().prepare("UPDATE customers SET password = @password WHERE id = @id").run({ id: row.id, password });
  return true;
}
