"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Bike, Lock, Save, ShoppingBag } from "@/components/Icons";

const cards = [
  {
    href: "/admin",
    title: "Pedidos e cardapio",
    text: "Pedidos do dia, comprovantes, clientes, produtos e configuracoes da loja.",
    icon: ShoppingBag
  },
  {
    href: "/estoque",
    title: "Estoque e producao",
    text: "Ingredientes, fichas tecnicas, producao, perdas, vendas e historico.",
    icon: Save
  },
  {
    href: "/erp",
    title: "ERP geral",
    text: "Financeiro, CRM, marketing, entregas, auditoria e inteligencia do negocio.",
    icon: Bike
  }
];

export default function GestaoPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("ibejinhos-admin-password");
    if (stored) {
      setPassword(stored);
      setUnlocked(true);
    }
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/erp", { headers: { "x-admin-password": password } });
    if (!response.ok) {
      setMessage("Senha invalida.");
      setUnlocked(false);
      return;
    }
    window.localStorage.setItem("ibejinhos-admin-password", password);
    setUnlocked(true);
    setMessage("");
  }

  function logout() {
    window.localStorage.removeItem("ibejinhos-admin-password");
    setUnlocked(false);
    setPassword("");
  }

  if (!unlocked) {
    return (
      <main className="mx-auto grid min-h-[calc(100vh-76px)] max-w-md place-items-center px-4">
        <form onSubmit={handleLogin} className="w-full rounded-lg border border-cocoa/10 bg-white/85 p-6 shadow-soft">
          <Lock className="mb-4 text-gold" size={30} />
          <h1 className="text-2xl font-black text-cocoa">Entrada da gestao</h1>
          <p className="mt-2 leading-6 text-truffle">Esta area e separada da loja do cliente.</p>
          <input className="mt-5 w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Senha da gestao" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {message && <p className="mt-3 rounded-lg bg-blush/45 p-3 text-sm font-bold text-cocoa">{message}</p>}
          <button className="mt-5 w-full rounded-full bg-cocoa px-5 py-3 font-black text-cream">Entrar</button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-gold">Area interna</p>
          <h1 className="mt-3 text-3xl font-black text-cocoa sm:text-5xl">Gestao Ibejinhos</h1>
          <p className="mt-4 max-w-2xl leading-7 text-truffle">Sua entrada privada para administrar loja, estoque, financeiro e operacao.</p>
        </div>
        <button onClick={logout} className="rounded-full bg-white px-5 py-3 font-black text-cocoa shadow-soft">Sair</button>
      </div>

      <section className="grid gap-5 md:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="rounded-lg border border-cocoa/10 bg-white/82 p-5 shadow-soft transition hover:-translate-y-1 hover:bg-white">
            <card.icon className="text-gold" size={30} />
            <h2 className="mt-5 text-xl font-black text-cocoa">{card.title}</h2>
            <p className="mt-3 leading-6 text-truffle">{card.text}</p>
            <span className="mt-5 inline-flex rounded-full bg-cocoa px-4 py-2 text-sm font-black text-cream">Abrir</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
