"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bike, Gift, Lock, Plus, Save } from "@/components/Icons";
import { formatCurrency } from "@/lib/format";

type ErpSummary = {
  kpis: Record<string, number>;
  financial: {
    expenses: { id: number; name: string; category: string; amount: number; dueDate: string; paid: boolean; recurring: boolean; type: string }[];
    receivables: { id: number; customerName: string; description: string; amount: number; dueDate: string; received: boolean }[];
    dre: { label: string; amount: number }[];
  };
  crm: {
    customers: { key: string; name: string; whatsapp: string; totalSpent: number; averageTicket: number; orders: number; favorites: string; points: number; cashback: number; segment: string; inactiveForDays: number }[];
    vip: unknown[];
    inactive: unknown[];
    recurring: unknown[];
    birthdays: unknown[];
  };
  loyalty: {
    rules: { pointsPerReal: number; cashbackPercent: number; vipThresholdPoints: number; inactiveDays: number };
    topCustomers: { key: string; name: string; points: number; cashback: number; segment: string }[];
  };
  marketing: { campaigns: { name: string; channel: string; audience: number; suggestion: string }[] };
  delivery: { batches: { neighborhood: string; orders: number; total: number; km: number }[]; totalKm: number; estimatedMinutes: number };
  intelligence: {
    alerts: { title: string; detail: string; action: string }[];
    productProfit: { id: number; name: string; profitAmount: number; profitPercent: number; finishedStock: number; suggestedPrice: number }[];
    demandSuggestions: { productName: string; soldQuantity: number; suggestedProduction: number; reason: string }[];
    reorderSuggestions: { ingredientName: string; suggestedQuantity: number; supplier: string }[];
  };
  admin: { users: { id: number; name: string; email: string; role: string; active: boolean }[]; auditLogs: Record<string, unknown>[] };
};

type Tab = "dashboard" | "finance" | "crm" | "loyalty" | "marketing" | "delivery" | "admin";

const today = new Date().toISOString().slice(0, 10);

const blankExpense = {
  name: "",
  category: "Operacao",
  amount: 0,
  dueDate: today,
  recurring: false,
  type: "variavel"
};

function asText(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="rounded-lg border border-cocoa/10 bg-white/82 p-4 shadow-soft">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-gold">{label}</span>
      <strong className="mt-2 block text-2xl text-cocoa">{value}</strong>
      {detail && <p className="mt-1 text-sm font-bold text-truffle">{detail}</p>}
    </article>
  );
}

function Pill({ children, tone = "cream" }: { children: React.ReactNode; tone?: "cream" | "rose" | "good" }) {
  const styles = {
    cream: "bg-cream text-cocoa",
    rose: "bg-blush/30 text-cocoa",
    good: "bg-pistachio/35 text-cocoa"
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${styles[tone]}`}>{children}</span>;
}

export default function ErpPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<ErpSummary | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [expense, setExpense] = useState(blankExpense);
  const [rules, setRules] = useState({ pointsPerReal: 1, cashbackPercent: 3, vipThresholdPoints: 1200, inactiveDays: 45 });

  const topProfitMax = useMemo(() => {
    return Math.max(...(summary?.intelligence.productProfit.map((item) => item.profitAmount) ?? [1]), 1);
  }, [summary]);

  async function load(secret = password) {
    const response = await fetch("/api/erp", { headers: { "x-admin-password": secret } });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Senha invalida.");
      setUnlocked(false);
      return;
    }
    setSummary(data);
    setRules(data.loyalty.rules);
    setUnlocked(true);
    setMessage("");
  }

  useEffect(() => {
    const stored = window.localStorage.getItem("ibejinhos-admin-password");
    if (stored) {
      setPassword(stored);
      load(stored);
    }
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Entrando...");
    const authResponse = await fetch("/api/admin-auth", { headers: { "x-admin-password": password } });
    if (!authResponse.ok) {
      setMessage("Senha invalida.");
      setUnlocked(false);
      return;
    }
    window.localStorage.setItem("ibejinhos-admin-password", password);
    await load(password);
  }

  async function send(action: string, payload: Record<string, unknown>, success: string) {
    const response = await fetch("/api/erp", {
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

  if (!unlocked || !summary) {
    return (
      <main className="mx-auto grid min-h-[calc(100vh-76px)] max-w-md place-items-center px-4">
        <div className="w-full rounded-lg border border-cocoa/10 bg-white/85 p-6 shadow-soft">
          <Lock className="mb-4 text-gold" size={30} />
          <h1 className="text-2xl font-black text-cocoa">ERP Ibejinhos</h1>
          <p className="mt-2 leading-6 text-truffle">Esta area fica dentro da gestao. Entre primeiro pela central administrativa.</p>
          {message && <p className="mt-3 rounded-lg bg-blush/45 p-3 text-sm font-bold text-cocoa">{message}</p>}
          <Link href="/gestao" className="mt-5 inline-flex w-full justify-center rounded-full bg-cocoa px-5 py-3 font-black text-cream">Ir para gestao</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-gold">Operacao integrada</p>
          <h1 className="mt-2 text-3xl font-black text-cocoa sm:text-5xl">ERP Ibejinhos</h1>
          <p className="mt-3 max-w-2xl leading-7 text-truffle">Pedidos, estoque, producao, financeiro, clientes e entregas conversando em um painel de gestao boutique.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Mes" value={formatCurrency(summary.kpis.monthlyRevenue)} />
          <Metric label="Lucro" value={formatCurrency(summary.kpis.netProfit)} />
          <Metric label="Clientes ativos" value={String(summary.kpis.activeCustomers)} />
          <Metric label="Entregas" value={String(summary.kpis.pendingDeliveries)} />
        </div>
      </div>

      {message && <p className="mb-5 rounded-lg bg-blush/35 p-3 font-bold text-cocoa">{message}</p>}

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {[
          ["dashboard", "Dashboard"],
          ["finance", "Financeiro"],
          ["crm", "CRM"],
          ["loyalty", "Fidelidade"],
          ["marketing", "Marketing"],
          ["delivery", "Entregas"],
          ["admin", "Acesso"]
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as Tab)} className={`whitespace-nowrap rounded-full px-5 py-3 text-sm font-black ${tab === id ? "bg-cocoa text-cream" : "bg-white text-cocoa"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-4">
            <Metric label="Faturamento total" value={formatCurrency(summary.kpis.revenue)} detail={`${summary.kpis.orders} pedidos`} />
            <Metric label="Lucro bruto" value={formatCurrency(summary.kpis.grossProfit)} detail={`CMV ${formatCurrency(summary.kpis.cogs)}`} />
            <Metric label="Margem liquida" value={`${summary.kpis.margin.toFixed(1)}%`} detail="Depois de despesas pagas" />
            <Metric label="Estoque parado" value={formatCurrency(summary.kpis.inventoryValue)} detail="Ingredientes cadastrados" />
          </div>

          <article className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft">
            <h2 className="text-xl font-black text-cocoa">Produtos mais lucrativos</h2>
            <div className="mt-5 space-y-4">
              {summary.intelligence.productProfit.slice(0, 6).map((item) => (
                <div key={item.id}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <strong className="text-cocoa">{item.name}</strong>
                    <span className="font-bold text-truffle">{formatCurrency(item.profitAmount)} | {item.profitPercent.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-cream">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(10, (item.profitAmount / topProfitMax) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft">
            <h2 className="text-xl font-black text-cocoa">Inteligencia operacional</h2>
            <div className="mt-4 space-y-3">
              {summary.intelligence.alerts.length === 0 && <p className="rounded-lg bg-cream p-4 font-bold text-truffle">Sem alertas criticos agora.</p>}
              {summary.intelligence.alerts.slice(0, 6).map((alert) => (
                <div key={`${alert.title}-${alert.detail}`} className="flex items-center justify-between gap-4 rounded-lg bg-cream p-4">
                  <div>
                    <strong className="block text-cocoa">{alert.title}</strong>
                    <span className="text-sm text-truffle">{alert.detail}</span>
                  </div>
                  <Pill tone="rose">{alert.action}</Pill>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft lg:col-span-2">
            <h2 className="text-xl font-black text-cocoa">Sugestao de producao</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {summary.intelligence.demandSuggestions.length === 0 && <p className="rounded-lg bg-cream p-4 font-bold text-truffle">Registre vendas no estoque para gerar previsoes.</p>}
              {summary.intelligence.demandSuggestions.map((item) => (
                <div key={item.productName} className="rounded-lg bg-cream p-4">
                  <strong className="text-cocoa">{item.productName}</strong>
                  <p className="mt-2 text-sm font-bold text-truffle">Vendeu {item.soldQuantity} un. Sugestao: produzir {item.suggestedProduction} un.</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}

      {tab === "finance" && (
        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (await send("createExpense", { expense }, "Despesa registrada.")) setExpense(blankExpense);
            }}
            className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft"
          >
            <h2 className="text-xl font-black text-cocoa">Conta a pagar</h2>
            <div className="mt-4 space-y-3">
              <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Despesa" value={expense.name} onChange={(event) => setExpense({ ...expense, name: event.target.value })} />
              <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Categoria" value={expense.category} onChange={(event) => setExpense({ ...expense, category: event.target.value })} />
              <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" type="number" step="0.01" placeholder="Valor" value={expense.amount || ""} onChange={(event) => setExpense({ ...expense, amount: Number(event.target.value) })} />
              <label className="block text-sm font-bold text-cocoa">Vencimento<input className="mt-1 w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" type="date" value={expense.dueDate} onChange={(event) => setExpense({ ...expense, dueDate: event.target.value })} /></label>
              <select className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" value={expense.type} onChange={(event) => setExpense({ ...expense, type: event.target.value })}>
                <option value="fixa">Fixa</option>
                <option value="variavel">Variavel</option>
              </select>
              <label className="flex items-center gap-3 rounded-lg bg-cream px-4 py-3 font-bold text-cocoa"><input type="checkbox" checked={expense.recurring} onChange={(event) => setExpense({ ...expense, recurring: event.target.checked })} /> Recorrente</label>
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cocoa px-5 py-3 font-black text-cream"><Plus size={18} /> Registrar</button>
            </div>
          </form>

          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Semana" value={formatCurrency(summary.kpis.weeklyRevenue)} />
              <Metric label="A receber" value={formatCurrency(summary.kpis.openReceivables)} />
              <Metric label="A pagar" value={formatCurrency(summary.kpis.openExpenses)} />
            </div>
            <Table title="DRE simplificada" rows={summary.financial.dre} columns={[["label", "Conta"], ["amount", "Valor"]]} currencyKeys={["amount"]} />
            <div className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft">
              <h2 className="text-xl font-black text-cocoa">Contas a pagar</h2>
              <div className="mt-4 space-y-3">
                {summary.financial.expenses.map((item) => (
                  <div key={item.id} className="flex flex-col justify-between gap-3 rounded-lg bg-cream p-4 sm:flex-row sm:items-center">
                    <div>
                      <strong className="block text-cocoa">{item.name}</strong>
                      <span className="text-sm font-bold text-truffle">{item.category} | {formatDate(item.dueDate)} | {formatCurrency(item.amount)}</span>
                    </div>
                    <button type="button" onClick={() => send("toggleExpense", { id: item.id, paid: !item.paid }, "Despesa atualizada.")} className="rounded-full bg-white px-4 py-2 font-black text-cocoa">
                      {item.paid ? "Pago" : "Marcar pago"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === "crm" && (
        <section className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="VIP" value={String(summary.crm.vip.length)} />
            <Metric label="Recorrentes" value={String(summary.crm.recurring.length)} />
            <Metric label="Inativos" value={String(summary.crm.inactive.length)} />
            <Metric label="Aniversarios" value={String(summary.crm.birthdays.length)} />
          </div>
          <div className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft">
            <h2 className="text-xl font-black text-cocoa">Clientes inteligentes</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-cream text-cocoa"><tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Segmento</th><th className="px-4 py-3">Pedidos</th><th className="px-4 py-3">Ticket medio</th><th className="px-4 py-3">Favorito</th><th className="px-4 py-3">Pontos</th></tr></thead>
                <tbody className="divide-y divide-cocoa/10 bg-white">
                  {summary.crm.customers.map((customer) => (
                    <tr key={customer.key}>
                      <td className="px-4 py-3"><strong className="block text-cocoa">{customer.name}</strong><span className="text-truffle">{customer.whatsapp}</span></td>
                      <td className="px-4 py-3"><Pill tone={customer.segment === "VIP" ? "good" : customer.segment === "Inativo" ? "rose" : "cream"}>{customer.segment}</Pill></td>
                      <td className="px-4 py-3 text-truffle">{customer.orders}</td>
                      <td className="px-4 py-3 text-truffle">{formatCurrency(customer.averageTicket)}</td>
                      <td className="px-4 py-3 text-truffle">{customer.favorites || "-"}</td>
                      <td className="px-4 py-3 text-truffle">{customer.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {tab === "loyalty" && (
        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await send("updateLoyalty", { rules }, "Regras de fidelidade salvas.");
            }}
            className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft"
          >
            <Gift className="mb-3 text-gold" size={28} />
            <h2 className="text-xl font-black text-cocoa">Regras configuraveis</h2>
            <p className="mt-2 text-sm leading-6 text-truffle">
              Estas regras servem para classificar clientes no CRM e calcular estimativas internas. O Cartao Doce de 10 pedidos continua valendo para o desconto da loja.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-bold text-cocoa">
                Pontos por real gasto
                <span className="mb-1 mt-1 block text-xs font-bold text-truffle">Exemplo: 1 ponto por cada R$ 1 comprado.</span>
                <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" type="number" step="0.1" value={rules.pointsPerReal} onChange={(event) => setRules({ ...rules, pointsPerReal: Number(event.target.value) })} />
              </label>
              <label className="block text-sm font-bold text-cocoa">
                Cashback estimado (%)
                <span className="mb-1 mt-1 block text-xs font-bold text-truffle">Percentual usado apenas para calcular uma previsao de credito interno.</span>
                <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" type="number" step="0.1" value={rules.cashbackPercent} onChange={(event) => setRules({ ...rules, cashbackPercent: Number(event.target.value) })} />
              </label>
              <label className="block text-sm font-bold text-cocoa">
                Pontos para virar VIP
                <span className="mb-1 mt-1 block text-xs font-bold text-truffle">Criterio VIP: total gasto x pontos por real precisa atingir este numero.</span>
                <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" type="number" step="1" value={rules.vipThresholdPoints} onChange={(event) => setRules({ ...rules, vipThresholdPoints: Number(event.target.value) })} />
              </label>
              <label className="block text-sm font-bold text-cocoa">
                Dias para considerar inativo
                <span className="mb-1 mt-1 block text-xs font-bold text-truffle">Depois desse tempo sem comprar, o cliente entra em recuperacao.</span>
                <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" type="number" step="1" value={rules.inactiveDays} onChange={(event) => setRules({ ...rules, inactiveDays: Number(event.target.value) })} />
              </label>
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cocoa px-5 py-3 font-black text-cream"><Save size={18} /> Salvar regras</button>
            </div>
          </form>
          <div className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft">
            <h2 className="text-xl font-black text-cocoa">Ranking de fidelidade</h2>
            <p className="mt-2 rounded-lg bg-cream p-3 text-sm font-bold leading-6 text-cocoa">
              VIP hoje significa atingir {summary.loyalty.rules.vipThresholdPoints} pontos. Com {summary.loyalty.rules.pointsPerReal} ponto(s) por real, isso equivale a aproximadamente {formatCurrency(summary.loyalty.rules.vipThresholdPoints / Math.max(summary.loyalty.rules.pointsPerReal, 0.01))} em compras.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {summary.loyalty.topCustomers.map((customer) => (
                <article key={customer.key} className="rounded-lg bg-cream p-4">
                  <div className="flex items-start justify-between gap-3">
                    <strong className="text-cocoa">{customer.name}</strong>
                    <Pill tone={customer.segment === "VIP" ? "good" : "cream"}>{customer.segment}</Pill>
                  </div>
                  <p className="mt-2 text-sm font-bold text-truffle">{customer.points} pontos | {formatCurrency(customer.cashback)} cashback estimado</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "marketing" && (
        <section className="grid gap-5 md:grid-cols-3">
          {summary.marketing.campaigns.map((campaign) => (
            <article key={campaign.name} className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft">
              <p className="text-sm font-black uppercase tracking-[0.14em] text-gold">{campaign.channel}</p>
              <h2 className="mt-2 text-xl font-black text-cocoa">{campaign.name}</h2>
              <strong className="mt-4 block text-4xl text-cocoa">{campaign.audience}</strong>
              <p className="mt-3 leading-6 text-truffle">{campaign.suggestion}</p>
            </article>
          ))}
        </section>
      )}

      {tab === "delivery" && (
        <section className="grid gap-5 lg:grid-cols-[0.8fr_1fr]">
          <article className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft">
            <Bike className="mb-3 text-gold" size={28} />
            <h2 className="text-xl font-black text-cocoa">Roteirizacao</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="Km estimado" value={`${summary.delivery.totalKm.toFixed(1)} km`} />
              <Metric label="Tempo" value={`${summary.delivery.estimatedMinutes} min`} />
            </div>
          </article>
          <div className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft">
            <h2 className="text-xl font-black text-cocoa">Agrupamento por bairro</h2>
            <div className="mt-4 space-y-3">
              {summary.delivery.batches.length === 0 && <p className="rounded-lg bg-cream p-4 font-bold text-truffle">Sem entregas pendentes.</p>}
              {summary.delivery.batches.map((batch) => (
                <div key={batch.neighborhood} className="flex flex-col justify-between gap-2 rounded-lg bg-cream p-4 sm:flex-row sm:items-center">
                  <div><strong className="text-cocoa">{batch.neighborhood}</strong><p className="text-sm font-bold text-truffle">{batch.orders} pedido(s), {batch.km.toFixed(1)} km</p></div>
                  <Pill>{formatCurrency(batch.total)}</Pill>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "admin" && (
        <section className="grid gap-5 lg:grid-cols-2">
          <Table title="Usuarios e permissoes" rows={summary.admin.users} columns={[["name", "Nome"], ["email", "Email"], ["role", "Papel"], ["active", "Ativo"]]} booleanKeys={["active"]} />
          <Table title="Auditoria" rows={summary.admin.auditLogs} columns={[["created_at", "Data"], ["actor", "Usuario"], ["action", "Acao"], ["details", "Detalhe"]]} />
        </section>
      )}
    </main>
  );
}

function Table({
  title,
  rows,
  columns,
  currencyKeys = [],
  booleanKeys = []
}: {
  title: string;
  rows: Record<string, unknown>[];
  columns: [string, string][];
  currencyKeys?: string[];
  booleanKeys?: string[];
}) {
  return (
    <div className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft">
      <h2 className="text-xl font-black text-cocoa">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-cream text-cocoa"><tr>{columns.map(([, label]) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-cocoa/10 bg-white">
            {rows.map((row, index) => (
              <tr key={asText(row.id) || index}>
                {columns.map(([key]) => {
                  const value = row[key];
                  const display = currencyKeys.includes(key) ? formatCurrency(Number(value)) : booleanKeys.includes(key) ? (value ? "Sim" : "Nao") : asText(value);
                  return <td key={key} className="px-4 py-3 text-truffle">{display || "-"}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
