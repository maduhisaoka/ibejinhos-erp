"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCustomerSession, type CustomerSession } from "@/lib/customerSession";

export function RequireCustomer({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<CustomerSession | null | undefined>(undefined);

  useEffect(() => {
    setSession(getCustomerSession());
  }, []);

  if (session === undefined) {
    return <p className="rounded-lg bg-white/78 p-5 text-truffle shadow-soft">Carregando cadastro...</p>;
  }

  if (!session) {
    return (
      <section className="rounded-lg border border-cocoa/10 bg-white/78 p-6 shadow-soft">
        <h2 className="text-2xl font-bold text-cocoa">Entre no cadastro para comprar</h2>
        <p className="mt-3 leading-7 text-truffle">
          Para proteger seus pedidos e sua pontuação de fidelidade, o cardápio é liberado depois do cadastro ou login.
        </p>
        <Link className="mt-5 inline-flex rounded-full bg-cocoa px-6 py-3 font-bold text-cream" href="/cliente">
          Entrar ou cadastrar
        </Link>
      </section>
    );
  }

  return <>{children}</>;
}
