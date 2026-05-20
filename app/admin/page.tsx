"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Lock, Plus, Save, Trash2 } from "@/components/Icons";
import { adminPasswordKey, adminUnlockedKey, fallbackAdminPassword } from "@/lib/adminSession";
import { formatCurrency } from "@/lib/format";
import type { Order, OrderStatus, Product, RegisteredCustomer, StoreSettings } from "@/lib/types";

const blankProduct: Omit<Product, "id"> = {
  name: "",
  description: "",
  price: 0,
  image: "/products/brigadeiro-gourmet.svg",
  active: true,
  flavorLimit: 0,
  flavors: []
};

type AdminTab = "products" | "orders" | "receipts" | "weekly" | "charts" | "settings" | "customers";

type ItemTotal = {
  name: string;
  quantity: number;
  revenue: number;
};

function getOrderDate(order: Order) {
  return new Date(order.createdAt);
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function endOfWeek(date: Date) {
  const copy = startOfWeek(date);
  copy.setDate(copy.getDate() + 6);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatWeekRange(date: Date) {
  return `${formatDate(startOfWeek(date))} a ${formatDate(endOfWeek(date))}`;
}

function summarizeItems(orders: Order[]): ItemTotal[] {
  const totals = new Map<string, ItemTotal>();

  for (const order of orders) {
    for (const item of order.items) {
      const current = totals.get(item.name) ?? { name: item.name, quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.price * item.quantity;
      totals.set(item.name, current);
    }
  }

  return Array.from(totals.values()).sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<RegisteredCustomer[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({ minimumOrderValue: 0 });
  const [editing, setEditing] = useState<(Product & { id?: number }) | Omit<Product, "id">>(blankProduct);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("products");
  const weeklyHistory = useMemo(() => {
    const grouped = new Map<string, { start: Date; orders: Order[] }>();

    for (const order of orders) {
      const start = startOfWeek(getOrderDate(order));
      const key = start.toISOString().slice(0, 10);
      const current = grouped.get(key) ?? { start, orders: [] };
      current.orders.push(order);
      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .sort((a, b) => b.start.getTime() - a.start.getTime())
      .map((week) => ({
        ...week,
        total: week.orders.reduce((sum, order) => sum + order.total, 0),
        items: summarizeItems(week.orders)
      }));
  }, [orders]);
  const chartSummary = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const weekOrders = orders.filter((order) => {
      const date = getOrderDate(order);
      return date >= weekStart && date <= weekEnd;
    });
    const monthOrders = orders.filter((order) => {
      const date = getOrderDate(order);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });

    return {
      weekOrders,
      monthOrders,
      weekItems: summarizeItems(weekOrders),
      monthItems: summarizeItems(monthOrders)
    };
  }, [orders]);

  async function loadAdminData(secret = password) {
    const [productsResponse, ordersResponse, customersResponse, settingsResponse] = await Promise.all([
      fetch("/api/products?admin=true"),
      fetch("/api/orders", { headers: { "x-admin-password": secret } }),
      fetch("/api/customers", { headers: { "x-admin-password": secret } }),
      fetch("/api/settings")
    ]);

    if (ordersResponse.status === 401) {
      if (secret !== fallbackAdminPassword) {
        setPassword(fallbackAdminPassword);
        window.localStorage.setItem(adminPasswordKey, fallbackAdminPassword);
        window.localStorage.setItem(adminUnlockedKey, "true");
        window.dispatchEvent(new Event("ibejinhos-admin-auth-changed"));
        await loadAdminData(fallbackAdminPassword);
        return;
      }
      window.localStorage.removeItem(adminPasswordKey);
      window.localStorage.removeItem(adminUnlockedKey);
      window.dispatchEvent(new Event("ibejinhos-admin-auth-changed"));
      setMessage("Entre novamente pela gestão.");
      setUnlocked(false);
      return;
    }

    if (!ordersResponse.ok) {
      setUnlocked(true);
      setMessage("Não consegui carregar os pedidos agora. Tente novamente em instantes.");
      return;
    }

    if (productsResponse.ok) setProducts(await productsResponse.json());
    setOrders(await ordersResponse.json());
    if (customersResponse.ok) setCustomers(await customersResponse.json());
    if (settingsResponse.ok) setSettings(await settingsResponse.json());
    window.localStorage.setItem(adminPasswordKey, secret);
    window.localStorage.setItem(adminUnlockedKey, "true");
    window.dispatchEvent(new Event("ibejinhos-admin-auth-changed"));
    setUnlocked(true);
    setMessage("");
  }

  useEffect(() => {
    const stored = window.localStorage.getItem(adminPasswordKey);
    const isAllowed = window.localStorage.getItem(adminUnlockedKey) === "true" || Boolean(stored);
    if (isAllowed) {
      const secret = stored || fallbackAdminPassword;
      setPassword(secret);
      setUnlocked(true);
      loadAdminData(secret);
    }
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Entrando...");
    const authResponse = await fetch("/api/admin-auth", { headers: { "x-admin-password": password } });
    if (!authResponse.ok) {
      setMessage("Senha inválida.");
      setUnlocked(false);
      return;
    }
    window.localStorage.setItem(adminPasswordKey, password);
    window.localStorage.setItem(adminUnlockedKey, "true");
    window.dispatchEvent(new Event("ibejinhos-admin-auth-changed"));
    await loadAdminData(password);
  }

  async function handleProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password
      },
      body: JSON.stringify(editing)
    });

    if (!response.ok) {
      const data = await response.json();
      setMessage(data.error ?? "Não foi possível salvar.");
      return;
    }

    setEditing(blankProduct);
    setMessage("Produto salvo com carinho.");
    await loadAdminData(password);
  }

  async function handleSettingsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password
      },
      body: JSON.stringify(settings)
    });

    if (!response.ok) {
      const data = await response.json();
      setMessage(data.error ?? "Não foi possível salvar as configurações.");
      return;
    }

    setSettings(await response.json());
    setMessage("Configurações salvas.");
  }

  async function uploadFile(file: File, type: "products" | "receipts", orderId?: number) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    if (orderId) {
      formData.append("orderId", String(orderId));
    }

    const response = await fetch("/api/uploads", {
      method: "POST",
      headers: { "x-admin-password": password },
      body: formData
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Não foi possível anexar o arquivo.");
      return null;
    }

    return String(data.url);
  }

  async function handleProductPhotoUpload(file: File | undefined) {
    if (!file) return;
    const url = await uploadFile(file, "products");
    if (url) {
      setEditing((current) => ({ ...current, image: url }));
      setMessage("Foto do produto anexada. Clique em salvar produto para confirmar.");
    }
  }

  async function handleReceiptUpload(orderId: number, file: File | undefined) {
    if (!file) return;
    const url = await uploadFile(file, "receipts", orderId);
    if (url) {
      setMessage("Comprovante anexado ao pedido.");
      await loadAdminData(password);
    }
  }

  async function toggleDelivered(orderId: number, delivered: boolean) {
    const previousOrders = orders;
    setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, delivered } : order)));

    const response = await fetch("/api/orders", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password
      },
      body: JSON.stringify({ id: orderId, delivered })
    });

    if (!response.ok) {
      setOrders(previousOrders);
      const data = await response.json();
      setMessage(data.error ?? "Não foi possível atualizar a entrega.");
    }
  }

  async function moveOrder(orderId: number, status: OrderStatus) {
    const previousOrders = orders;
    setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, status } : order)));

    const response = await fetch("/api/orders", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password
      },
      body: JSON.stringify({ id: orderId, status })
    });

    if (!response.ok) {
      setOrders(previousOrders);
      const data = await response.json();
      setMessage(data.error ?? "Não foi possível mover o pedido.");
    }
  }

  async function removeOrder(orderId: number) {
    const order = orders.find((item) => item.id === orderId);
    const confirmed = window.confirm(`Excluir o pedido ${order?.orderNumber ?? orderId}?`);
    if (!confirmed) return;

    const previousOrders = orders;
    setOrders((current) => current.filter((item) => item.id !== orderId));

    const response = await fetch("/api/orders", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password
      },
      body: JSON.stringify({ id: orderId })
    });

    if (!response.ok) {
      setOrders(previousOrders);
      const data = await response.json();
      setMessage(data.error ?? "Não foi possível excluir o pedido.");
      return;
    }

    setMessage("Pedido excluído.");
  }

  async function removeCustomer(customerId: number) {
    const customer = customers.find((item) => item.id === customerId);
    const confirmed = window.confirm(`Excluir o cadastro de ${customer?.name ?? "cliente"}? O histórico de pedidos será mantido.`);
    if (!confirmed) return;

    const previousCustomers = customers;
    setCustomers((current) => current.filter((item) => item.id !== customerId));

    const response = await fetch("/api/customers", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password
      },
      body: JSON.stringify({ id: customerId })
    });

    if (!response.ok) {
      setCustomers(previousCustomers);
      const data = await response.json();
      setMessage(data.error ?? "Não foi possível excluir o cliente.");
      return;
    }

    setMessage("Cliente excluído.");
  }

  function renderOrderCard(order: Order) {
    return (
      <article
        key={order.id}
        draggable
        onDragStart={(event) => event.dataTransfer.setData("text/plain", String(order.id))}
        className="cursor-grab rounded-lg bg-cream p-4 active:cursor-grabbing"
      >
        <div className="flex justify-between gap-3">
          <strong className="text-cocoa">Pedido {order.orderNumber}</strong>
          <span className="text-sm text-truffle">{new Date(order.createdAt).toLocaleString("pt-BR")}</span>
        </div>
        <p className="mt-2 text-sm text-truffle">{order.customerName} - {order.whatsapp}</p>
        {order.cpf && <p className="text-sm text-truffle">CPF: {order.cpf}</p>}
        <p className="text-sm text-truffle">Pontuação do cliente neste pedido: {order.loyaltyOrderCount}/10</p>
        <p className="text-sm text-truffle">
          Entrega: {order.street}, {order.number}{order.complement ? ` - ${order.complement}` : ""}, {order.neighborhood} - {order.cep}
        </p>
        {!order.deliverySameAsRegistration && (
          <p className="text-sm text-truffle">
            Cadastro: {order.registrationStreet}, {order.registrationNumber}{order.registrationComplement ? ` - ${order.registrationComplement}` : ""}, {order.registrationNeighborhood} - {order.registrationCep}
          </p>
        )}
        {order.deliveryDistanceKm && (
          <p className="text-sm text-truffle">
            Distância estimada: {order.deliveryDistanceKm.toFixed(1)} km da Avenida Jacutinga, 242
          </p>
        )}
        <ul className="mt-3 text-sm text-cocoa">
          {order.items.map((item) => (
            <li key={`${order.id}-${item.id}`}>
              {item.quantity}x {item.name}
              {Object.entries(item.selectedFlavors ?? {}).filter(([, quantity]) => quantity > 0).length > 0 && (
                <span className="block text-xs text-truffle">
                  {Object.entries(item.selectedFlavors)
                    .filter(([, quantity]) => quantity > 0)
                    .map(([flavor, quantity]) => `${quantity}x ${flavor}`)
                    .join(", ")}
                </span>
              )}
            </li>
          ))}
        </ul>
        {order.discount > 0 && <p className="mt-2 text-sm font-bold text-blush">Desconto fidelidade: -{formatCurrency(order.discount)}</p>}
        <strong className="mt-3 block text-gold">{formatCurrency(order.total)} - {order.paymentMethod}</strong>
        {order.receiptPath && (
          <a className="mt-3 inline-block text-sm font-bold text-cocoa underline" href={order.receiptPath} target="_blank">
            Ver comprovante anexado
          </a>
        )}
        <button
          type="button"
          onClick={() => toggleDelivered(order.id, !order.delivered)}
          className={`mt-3 mr-2 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-bold ${order.delivered ? "bg-cocoa text-cream" : "bg-white text-cocoa"}`}
        >
          {order.delivered ? "Pedido entregue" : "Marcar como entregue"}
        </button>
        <button
          type="button"
          onClick={() => removeOrder(order.id)}
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-cocoa"
        >
          <Trash2 size={15} /> Excluir pedido
        </button>
      </article>
    );
  }

  function OrderColumn({ status, title }: { status: OrderStatus; title: string }) {
    const columnOrders = orders.filter((order) => (order.status ?? "preparando") === status);

    return (
      <section
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const orderId = Number(event.dataTransfer.getData("text/plain"));
          if (orderId) {
            moveOrder(orderId, status);
          }
        }}
        className="min-h-80 rounded-lg border border-cocoa/10 bg-white/78 p-5 shadow-soft"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-cocoa">{title}</h2>
          <span className="rounded-full bg-cream px-3 py-1 text-sm font-bold text-cocoa">{columnOrders.length}</span>
        </div>
        <div className="space-y-4">
          {columnOrders.length === 0 && (
            <p className="rounded-lg border border-dashed border-cocoa/20 p-4 text-sm font-bold text-truffle">
              Arraste pedidos para cá.
            </p>
          )}
          {columnOrders.map(renderOrderCard)}
        </div>
      </section>
    );
  }

  function ItemBars({ items }: { items: ItemTotal[] }) {
    const max = Math.max(...items.map((item) => item.quantity), 1);

    if (items.length === 0) {
      return <p className="rounded-lg bg-cream p-4 text-sm font-bold text-truffle">Ainda não há itens neste período.</p>;
    }

    return (
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.name}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="font-bold text-cocoa">{item.name}</span>
              <span className="text-truffle">{item.quantity} un.</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-cream">
              <div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(8, (item.quantity / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!unlocked) {
    return (
      <main className="mx-auto grid min-h-[calc(100vh-76px)] max-w-md place-items-center px-4">
        <div className="w-full rounded-lg border border-cocoa/10 bg-white/78 p-6 shadow-soft">
          <Lock className="mb-4 text-gold" size={30} />
          <h1 className="text-2xl font-bold text-cocoa">Painel da Ibejinhos</h1>
          <p className="mt-2 leading-6 text-truffle">Esta área fica dentro da gestão. Entre primeiro pela central administrativa.</p>
          {message && <p className="mt-3 rounded-lg bg-blush p-3 text-sm text-cocoa">{message}</p>}
          <Link href="/gestao" className="mt-5 inline-flex w-full justify-center rounded-full bg-cocoa px-5 py-3 font-bold text-cream">Ir para gestão</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">Painel</p>
          <h1 className="mt-3 text-3xl font-bold text-cocoa sm:text-5xl">Gestão da Ibejinhos</h1>
        </div>
        {activeTab === "products" && (
          <button
            onClick={() => setEditing(blankProduct)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-cocoa px-5 py-3 font-semibold text-cream"
          >
            <Plus size={18} /> Novo produto
          </button>
        )}
      </div>

      {message && <p className="mb-5 rounded-lg bg-blush/70 p-3 text-cocoa">{message}</p>}

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          ["products", "Cardápio"],
          ["orders", "Pedidos"],
          ["weekly", "Semanas"],
          ["charts", "Gráficos"],
          ["customers", "Clientes"],
          ["settings", "Configurações"],
          ["receipts", "Comprovantes"]
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as AdminTab)}
            className={`rounded-full px-5 py-3 font-bold ${activeTab === id ? "bg-cocoa text-cream" : "bg-white text-cocoa"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "products" && (
        <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <form onSubmit={handleProductSubmit} className="h-fit rounded-lg border border-cocoa/10 bg-white/78 p-5 shadow-soft">
            <h2 className="text-xl font-bold text-cocoa">Produto</h2>
            <div className="mt-4 space-y-3">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-cream">
                {editing.image && <Image src={editing.image} alt={editing.name || "Foto do produto"} fill className="object-cover" />}
              </div>
              <label className="block rounded-lg bg-cream px-4 py-3 text-sm font-bold text-cocoa">
                Anexar foto oficial do produto
                <input className="mt-2 block w-full text-sm" type="file" accept="image/*" onChange={(event) => handleProductPhotoUpload(event.target.files?.[0])} />
              </label>
              <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Nome" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
              <textarea className="min-h-28 w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Descrição" value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} />
              <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Preço" type="number" step="0.01" value={editing.price || ""} onChange={(event) => setEditing({ ...editing, price: Number(event.target.value) })} />
              <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Caminho da imagem" value={editing.image} onChange={(event) => setEditing({ ...editing, image: event.target.value })} />
              <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Quantidade de sabores permitidos" type="number" min="0" value={editing.flavorLimit || ""} onChange={(event) => setEditing({ ...editing, flavorLimit: Number(event.target.value) })} />
              <textarea className="min-h-20 w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Sabores separados por vírgula" value={(editing.flavors ?? []).join(", ")} onChange={(event) => setEditing({ ...editing, flavors: event.target.value.split(",").map((flavor) => flavor.trim()).filter(Boolean) })} />
              <label className="flex items-center gap-3 rounded-lg bg-cream px-4 py-3 text-cocoa">
                <input type="checkbox" checked={editing.active} onChange={(event) => setEditing({ ...editing, active: event.target.checked })} />
                Produto ativo no cardápio
              </label>
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cocoa px-5 py-3 font-bold text-cream">
                <Save size={18} /> Salvar produto
              </button>
            </div>
          </form>

          <section className="rounded-lg border border-cocoa/10 bg-white/78 p-5 shadow-soft">
            <h2 className="text-xl font-bold text-cocoa">Cardápio</h2>
            <div className="mt-4 divide-y divide-cocoa/10">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => setEditing(product)}
                  className="flex w-full items-center justify-between gap-4 py-4 text-left"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-cream">
                      <Image src={product.image} alt={product.name} fill className="object-cover" />
                    </span>
                    <span>
                      <span className="block font-semibold text-cocoa">{product.name}</span>
                      <span className="text-sm text-truffle">{formatCurrency(product.price)}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-sm text-truffle">
                    {product.active ? <Eye size={17} /> : <EyeOff size={17} />}
                    {product.active ? "Ativo" : "Pausado"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </section>
      )}

      {activeTab === "settings" && (
        <section className="max-w-xl rounded-lg border border-cocoa/10 bg-white/78 p-5 shadow-soft">
          <h2 className="text-xl font-bold text-cocoa">Configurações da loja</h2>
          <form onSubmit={handleSettingsSubmit} className="mt-4 space-y-3">
            <label className="block text-sm font-bold text-cocoa">
              Valor mínimo do pedido
              <input
                className="mt-2 w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3"
                type="number"
                min="0"
                step="0.01"
                value={settings.minimumOrderValue || ""}
                onChange={(event) => setSettings({ ...settings, minimumOrderValue: Number(event.target.value) })}
              />
            </label>
            <button className="inline-flex items-center justify-center gap-2 rounded-full bg-cocoa px-5 py-3 font-bold text-cream">
              <Save size={18} /> Salvar configurações
            </button>
          </form>
        </section>
      )}

      {activeTab === "orders" && (
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-cocoa">Pedidos recebidos</h2>
            <p className="mt-1 text-sm font-bold text-truffle">Arraste os pedidos entre as colunas para atualizar o andamento.</p>
          </div>
          {orders.length === 0 ? (
            <p className="rounded-lg bg-white/78 p-5 text-truffle shadow-soft">Nenhum pedido recebido ainda.</p>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              <OrderColumn status="preparando" title="Sendo preparados" />
              <OrderColumn status="finalizado" title="Finalizados" />
            </div>
          )}
        </section>
      )}

      {activeTab === "weekly" && (
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-cocoa">Histórico das semanas</h2>
            <p className="mt-1 text-sm font-bold text-truffle">Resumo para fechar a produção: total de pedidos e quantidade de cada item vendido por semana.</p>
          </div>
          {weeklyHistory.length === 0 ? (
            <p className="rounded-lg bg-white/78 p-5 text-truffle shadow-soft">Nenhum pedido recebido ainda.</p>
          ) : (
            weeklyHistory.map((week) => (
              <article key={week.start.toISOString()} className="rounded-lg border border-cocoa/10 bg-white/78 p-5 shadow-soft">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-lg font-bold text-cocoa">Semana de {formatWeekRange(week.start)}</h3>
                    <p className="text-sm font-bold text-truffle">{week.orders.length} pedido(s) - {formatCurrency(week.total)}</p>
                  </div>
                </div>
                <div className="mt-4 overflow-hidden rounded-lg border border-cocoa/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-cream text-cocoa">
                      <tr>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">Quantidade</th>
                        <th className="px-4 py-3">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cocoa/10 bg-white">
                      {week.items.map((item) => (
                        <tr key={item.name}>
                          <td className="px-4 py-3 font-bold text-cocoa">{item.name}</td>
                          <td className="px-4 py-3 text-truffle">{item.quantity}</td>
                          <td className="px-4 py-3 text-truffle">{formatCurrency(item.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))
          )}
        </section>
      )}

      {activeTab === "charts" && (
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-cocoa">Gráficos de pedidos</h2>
            <p className="mt-1 text-sm font-bold text-truffle">Acompanhe pedidos gerais e os produtos mais pedidos na semana e no mês.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-lg border border-cocoa/10 bg-white/78 p-5 shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">Semana atual</p>
              <strong className="mt-3 block text-4xl text-cocoa">{chartSummary.weekOrders.length}</strong>
              <p className="mt-1 text-sm font-bold text-truffle">pedido(s) de {formatWeekRange(new Date())}</p>
              <div className="mt-5">
                <ItemBars items={chartSummary.weekItems} />
              </div>
            </article>
            <article className="rounded-lg border border-cocoa/10 bg-white/78 p-5 shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">Mês atual</p>
              <strong className="mt-3 block text-4xl text-cocoa">{chartSummary.monthOrders.length}</strong>
              <p className="mt-1 text-sm font-bold text-truffle">pedido(s) em {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
              <div className="mt-5">
                <ItemBars items={chartSummary.monthItems} />
              </div>
            </article>
          </div>
        </section>
      )}

      {activeTab === "customers" && (
        <section className="rounded-lg border border-cocoa/10 bg-white/78 p-5 shadow-soft">
          <h2 className="text-xl font-bold text-cocoa">Clientes cadastrados</h2>
          <div className="mt-4 space-y-3">
            {customers.length === 0 && <p className="text-truffle">Nenhum cliente cadastrado ainda.</p>}
            {customers.map((customer) => (
              <article key={customer.id} className="rounded-lg bg-cream p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row">
                  <div>
                    <strong className="block text-cocoa">{customer.name}</strong>
                    <span className="text-sm text-truffle">CPF: {customer.cpf} - {customer.email} - WhatsApp: {customer.whatsapp}</span>
                  </div>
                  {customer.birthdayDay && customer.birthdayMonth && (
                    <span className="text-sm font-bold text-gold">
                      Aniversário: {String(customer.birthdayDay).padStart(2, "0")}/{String(customer.birthdayMonth).padStart(2, "0")}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-truffle">
                  {customer.street}, {customer.number}{customer.complement ? ` - ${customer.complement}` : ""}, {customer.neighborhood} - {customer.cep}
                </p>
                <button
                  type="button"
                  onClick={() => removeCustomer(customer.id)}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-blush/35 px-4 py-2 text-sm font-bold text-cocoa"
                >
                  <Trash2 size={15} /> Excluir cliente
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === "receipts" && (
        <section className="rounded-lg border border-cocoa/10 bg-white/78 p-5 shadow-soft">
          <h2 className="text-xl font-bold text-cocoa">Comprovantes de pagamento</h2>
          <div className="mt-4 space-y-4">
            {orders.length === 0 && <p className="text-truffle">Nenhum pedido para anexar comprovante ainda.</p>}
            {orders.map((order) => (
              <article key={order.id} className="rounded-lg bg-cream p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <strong className="block text-cocoa">{order.orderNumber}</strong>
                    <span className="text-sm text-truffle">{order.customerName} - {formatCurrency(order.total)}</span>
                  </div>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-cocoa px-5 py-3 text-sm font-bold text-cream shadow-soft">
                    Adicionar comprovante
                    <input className="hidden" type="file" onChange={(event) => handleReceiptUpload(order.id, event.target.files?.[0])} />
                  </label>
                </div>
                {order.receiptPath && (
                  <a className="mt-3 inline-block text-sm font-bold text-cocoa underline" href={order.receiptPath} target="_blank">
                    Comprovante salvo
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
