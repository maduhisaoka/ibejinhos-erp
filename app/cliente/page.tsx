"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { clearCustomerSession, getCustomerSession, getCustomerSessionPassword, setCustomerSession, type CustomerSession } from "@/lib/customerSession";
import { formatCep, formatCpf, formatCurrency, formatPhone, isStrongPassword, normalizeCpf, onlyDigits } from "@/lib/format";
import type { LoyaltySummary, Order } from "@/lib/types";

type CustomerPortalData = {
  customer: CustomerSession | null;
  birthdayCouponAvailable: boolean;
  loyalty: LoyaltySummary;
  orders: Order[];
};

const emptyLoyalty: LoyaltySummary = {
  previousOrders: 0,
  currentOrderCount: 1,
  cycleOrderCount: 0,
  nextCycleOrderCount: 1,
  qualifiesForDiscount: false,
  ordersUntilDiscount: 10,
  discountRate: 0,
  rewardLabel: "Cartão Doce Ibejinhos",
  rewardDescription: "A cada 10 pedidos, o próximo pedido recebe 10% de desconto. Depois de usar o mimo, a contagem recomeça."
};

type RegisterForm = {
  name: string;
  cpf: string;
  email: string;
  password: string;
  whatsapp: string;
  birthdayDay: string;
  birthdayMonth: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
};

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function hasUsableCpf(value: string) {
  const cpf = onlyDigits(value);
  return cpf.length === 11 && !/^(\d)\1{10}$/.test(cpf);
}

function localPortalData(customer: CustomerSession): CustomerPortalData {
  return {
    customer,
    birthdayCouponAvailable: false,
    loyalty: emptyLoyalty,
    orders: []
  };
}

const blankRegister: RegisterForm = {
  name: "",
  cpf: "",
  email: "",
  password: "",
  whatsapp: "",
  birthdayDay: "",
  birthdayMonth: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: ""
};

export default function ClientePage() {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [register, setRegister] = useState<RegisterForm>(blankRegister);
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [data, setData] = useState<CustomerPortalData | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const current = getCustomerSession();
    const storedPassword = getCustomerSessionPassword();
    if (current) {
      setSession(current);
      setData(localPortalData(current));
      setCpf(formatCpf(current.cpf));
      setPassword(storedPassword);
      if (storedPassword) {
        loadPortal(current.cpf, storedPassword);
      }
    }
  }, []);

  async function loadPortal(nextCpf = cpf, nextPassword = password) {
    setError("");
    const normalizedCpf = normalizeCpf(nextCpf);
    if (!hasUsableCpf(normalizedCpf) || nextPassword.length < 1) {
      setError("Informe CPF e senha.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/customer?cpf=${normalizedCpf}&password=${encodeURIComponent(nextPassword)}`);
      const payload = await readJson(response);

      if (!response.ok) {
        const current = getCustomerSession();
        if (current && normalizeCpf(current.cpf) === normalizedCpf) {
          setSession(current);
          setData((existing) => existing ?? localPortalData(current));
          setMessage("Seus dados continuam salvos neste aparelho.");
          return;
        }
        setError(payload.error ?? "Não foi possível entrar.");
        return;
      }

      setCustomerSession(payload.customer, nextPassword);
      setSession(payload.customer);
      setData(payload);
      setMessage("Cadastro liberado. Você já pode comprar.");
    } catch {
      const current = getCustomerSession();
      if (current && normalizeCpf(current.cpf) === normalizedCpf) {
        setSession(current);
        setData((existing) => existing ?? localPortalData(current));
        setMessage("Seus dados continuam salvos neste aparelho.");
        return;
      }
      setError("Não foi possível entrar agora. Confira sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadPortal();
  }

  async function lookupCep(cep: string) {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) return;

    try {
      const response = await fetch(`/api/cep?cep=${digits}`);
      const payload = await readJson(response);
      if (!response.ok) {
        setError(payload.error ?? "CEP não encontrado.");
        return;
      }

      setRegister((current) => ({
        ...current,
        cep: formatCep(digits),
        street: payload.street || current.street,
        neighborhood: payload.neighborhood || current.neighborhood
      }));
    } catch {
      setError("Não foi possível buscar o CEP agora. Preencha o endereço manualmente.");
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!isStrongPassword(register.password)) {
      setError("A senha precisa ter pelo menos 8 caracteres, número e caractere especial.");
      return;
    }

    if (!hasUsableCpf(register.cpf)) {
      setError("Informe um CPF válido com 11 números.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...register, cpf: normalizeCpf(register.cpf) })
      });
      const payload = await readJson(response);

      if (!response.ok) {
        setError(payload.error ?? "Não foi possível cadastrar.");
        return;
      }

      setCustomerSession(payload.customer, register.password);
      setSession(payload.customer);
      setCpf(formatCpf(payload.customer.cpf));
      setPassword(register.password);
      setMode("login");
      setMessage("Cadastro criado. Agora o cardápio está liberado para você.");
      setData({
        customer: payload.customer,
        birthdayCouponAvailable: Boolean(payload.birthdayCouponAvailable),
        loyalty: payload.loyalty ?? emptyLoyalty,
        orders: payload.orders ?? []
      });
    } catch {
      setError("Não foi possível cadastrar agora. Confira sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    setLoading(true);
    try {
      const response = await fetch("/api/customer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: normalizeCpf(cpf), email: resetEmail })
      });
      const payload = await readJson(response);

      if (!response.ok) {
        setError(payload.error ?? "Não foi possível recuperar a senha.");
        return;
      }

      setPassword(payload.temporaryPassword ?? "");
      setMode("login");
      setMessage(`Senha temporária enviada para o e-mail cadastrado. Para teste local: ${payload.temporaryPassword}`);
    } catch {
      setError("Não foi possível recuperar a senha agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearCustomerSession();
    setSession(null);
    setData(null);
    setPassword("");
    setMessage("Você saiu do cadastro.");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">Cliente</p>
      <h1 className="mt-3 text-3xl font-bold text-cocoa sm:text-5xl">Meus pedidos</h1>
      <p className="mt-4 leading-7 text-truffle">
        Acompanhe seus pedidos, veja seu Cartão Doce e mantenha seus dados salvos neste aparelho.
      </p>

      {session && (
        <div className="mt-6 flex flex-col justify-between gap-3 rounded-lg bg-white/78 p-4 shadow-soft sm:flex-row sm:items-center">
          <p className="font-bold text-cocoa">Olá, {session.name}. Seu cadastro está ativo.</p>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-full bg-cocoa px-5 py-3 font-bold text-cream" href="/cardapio">Ver cardápio</Link>
            <button className="rounded-full bg-cream px-5 py-3 font-bold text-cocoa" onClick={logout}>Sair</button>
          </div>
        </div>
      )}

      {!session && (
        <div className="mt-8 flex flex-wrap gap-2">
          {[
            ["login", "Entrar"],
            ["register", "Cadastrar"],
            ["forgot", "Esqueci minha senha"]
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMode(id as "login" | "register" | "forgot")}
              className={`rounded-full px-5 py-3 font-bold ${mode === id ? "bg-cocoa text-cream" : "bg-white text-cocoa"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {message && <p className="mt-4 rounded-lg bg-white p-3 text-sm font-bold text-cocoa">{message}</p>}
      {error && <p className="mt-4 rounded-lg bg-blush p-3 text-sm font-bold text-cocoa">{error}</p>}

      {!session && mode === "login" && (
        <form onSubmit={handleLogin} className="mt-5 grid gap-3 rounded-lg border border-cocoa/10 bg-white/78 p-5 shadow-soft sm:grid-cols-[1fr_1fr_auto]">
          <input className="min-w-0 rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="CPF" value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} />
          <input className="min-w-0 rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Senha" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <button className="rounded-full bg-cocoa px-6 py-3 font-bold text-cream">{loading ? "Entrando..." : "Entrar"}</button>
        </form>
      )}

      {!session && mode === "register" && (
        <form onSubmit={handleRegister} className="mt-5 grid gap-3 rounded-lg border border-cocoa/10 bg-white/78 p-5 shadow-soft sm:grid-cols-2">
          <input required className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Nome completo" value={register.name} onChange={(event) => setRegister({ ...register, name: event.target.value })} />
          <input required className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="CPF" value={register.cpf} onChange={(event) => setRegister({ ...register, cpf: formatCpf(event.target.value) })} />
          <input required className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="E-mail" type="email" value={register.email} onChange={(event) => setRegister({ ...register, email: event.target.value })} />
          <input required className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="WhatsApp" value={register.whatsapp} onChange={(event) => setRegister({ ...register, whatsapp: formatPhone(event.target.value) })} />
          <input required className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Senha: 8 caracteres, número e especial" type="password" value={register.password} onChange={(event) => setRegister({ ...register, password: event.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input required className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Dia aniversário" type="number" min="1" max="31" value={register.birthdayDay} onChange={(event) => setRegister({ ...register, birthdayDay: event.target.value })} />
            <input required className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Mês" type="number" min="1" max="12" value={register.birthdayMonth} onChange={(event) => setRegister({ ...register, birthdayMonth: event.target.value })} />
          </div>
          <input required className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="CEP" value={register.cep} onChange={(event) => setRegister({ ...register, cep: formatCep(event.target.value) })} onBlur={(event) => lookupCep(event.target.value)} />
          <input required className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Logradouro" value={register.street} onChange={(event) => setRegister({ ...register, street: event.target.value })} />
          <input required className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Número" value={register.number} onChange={(event) => setRegister({ ...register, number: event.target.value })} />
          <input className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Complemento" value={register.complement} onChange={(event) => setRegister({ ...register, complement: event.target.value })} />
          <input required className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Bairro" value={register.neighborhood} onChange={(event) => setRegister({ ...register, neighborhood: event.target.value })} />
          <button className="rounded-full bg-cocoa px-6 py-3 font-bold text-cream sm:col-span-2">{loading ? "Cadastrando..." : "Criar cadastro"}</button>
        </form>
      )}

      {!session && mode === "forgot" && (
        <form onSubmit={handleForgot} className="mt-5 grid gap-3 rounded-lg border border-cocoa/10 bg-white/78 p-5 shadow-soft sm:grid-cols-[1fr_1fr_auto]">
          <input className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="CPF" value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} />
          <input className="rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="E-mail cadastrado" type="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} />
          <button className="rounded-full bg-cocoa px-6 py-3 font-bold text-cream">{loading ? "Enviando..." : "Enviar senha"}</button>
        </form>
      )}

      {data && (
        <section className="mt-6 space-y-5">
          <article className="rounded-lg border border-cocoa/10 bg-white/78 p-5 shadow-soft">
            <h2 className="text-xl font-bold text-cocoa">Fidelidade</h2>
            <p className="mt-2 leading-6 text-truffle">
              {data.loyalty.rewardDescription}
            </p>
            <div className="mt-4 rounded-lg bg-cream p-4">
              <div className="flex items-center justify-between gap-3 text-sm font-black text-cocoa">
                <span>Cartão atual</span>
                <span>{data.loyalty.cycleOrderCount}/10 pedidos</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, data.loyalty.cycleOrderCount * 10)}%` }} />
              </div>
              <p className="mt-3 text-sm font-bold text-truffle">
                {data.loyalty.qualifiesForDiscount
                  ? "Seu desconto está liberado para o próximo pedido. Depois dele, o cartão volta para 0/10."
                  : `Faltam ${data.loyalty.ordersUntilDiscount} pedido(s) para liberar o mimo.`}
              </p>
            </div>
            <p className="mt-3 text-sm font-bold text-truffle">
              Total histórico: {data.loyalty.previousOrders} pedido(s).
            </p>
            {data.birthdayCouponAvailable && <p className="mt-3 rounded-lg bg-cream p-3 text-sm font-bold text-cocoa">Cupom de aniversário ativo: 15% de desconto nesta semana.</p>}
          </article>

          <article className="rounded-lg border border-cocoa/10 bg-white/78 p-5 shadow-soft">
            <h2 className="text-xl font-bold text-cocoa">Histórico</h2>
            <div className="mt-4 space-y-3">
              {data.orders.length === 0 && <p className="text-truffle">Ainda não encontramos pedidos para este CPF.</p>}
              {data.orders.map((order) => (
                <div key={order.id} className="rounded-lg bg-cream p-4">
                  <div className="flex flex-col justify-between gap-1 sm:flex-row">
                    <strong className="text-cocoa">Pedido {order.orderNumber}</strong>
                    <span className="text-sm text-truffle">{new Date(order.createdAt).toLocaleString("pt-BR")}</span>
                  </div>
                  <ul className="mt-3 text-sm text-truffle">
                    {order.items.map((item) => <li key={`${order.id}-${item.id}`}>{item.quantity}x {item.name}</li>)}
                  </ul>
                  <strong className="mt-3 block text-gold">{formatCurrency(order.total)}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
