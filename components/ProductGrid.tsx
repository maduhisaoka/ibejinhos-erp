"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Minus, Plus, ShoppingBag } from "@/components/Icons";
import { useCart } from "@/components/CartContext";
import { getCustomerSession, type CustomerSession } from "@/lib/customerSession";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/lib/types";

function ProductImage({ src, alt }: { src: string; alt: string }) {
  if (src.startsWith("data:")) {
    return <img src={src} alt={alt} className="h-full w-full object-cover" />;
  }

  return <Image src={src} alt={alt} fill className="object-cover" unoptimized={src.startsWith("/uploads/")} />;
}

export function ProductGrid({ products }: { products: Product[] }) {
  const { addItem, count, items, updateQuantity } = useCart();
  const [session, setSession] = useState<CustomerSession | null>(null);

  useEffect(() => {
    setSession(getCustomerSession());
  }, []);

  return (
    <>
      {!session && (
        <div className="mb-5 flex justify-end">
          <Link className="rounded-full bg-cocoa px-5 py-3 text-sm font-bold text-cream shadow-soft" href="/cliente">Entrar ou cadastrar</Link>
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const selectedQuantity = items.find((item) => item.id === product.id)?.quantity ?? 0;

          return (
            <article key={product.id} className="overflow-hidden rounded-lg border border-cocoa/10 bg-white/72 shadow-soft">
              <div className="relative aspect-[4/3] bg-blush/40">
                <ProductImage src={product.image} alt={product.name} />
                {selectedQuantity > 0 && (
                  <span className="absolute right-3 top-3 rounded-full bg-blush px-3 py-1 text-sm font-black text-white shadow-soft">
                    {selectedQuantity} selecionado{selectedQuantity > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-semibold text-cocoa">{product.name}</h2>
                  <strong className="whitespace-nowrap text-gold">{formatCurrency(product.price)}</strong>
                </div>
                <p className="mt-3 min-h-20 leading-6 text-truffle">{product.description}</p>
                <div className="mt-5 flex items-center gap-3">
                  <button
                    onClick={() => updateQuantity(product.id, selectedQuantity - 1)}
                    disabled={selectedQuantity === 0 || !session}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-cocoa/20 bg-white text-cocoa disabled:opacity-50"
                    aria-label={`Diminuir ${product.name}`}
                  >
                    <Minus size={18} />
                  </button>
                  <div className="grid h-11 min-w-16 place-items-center rounded-full bg-cream px-4 text-lg font-black text-cocoa">
                    {selectedQuantity}
                  </div>
                  <button
                    onClick={() => {
                      if (session) addItem(product);
                    }}
                    disabled={!session}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-cocoa px-4 font-semibold text-cream transition hover:bg-truffle disabled:opacity-60"
                    aria-label={`Adicionar ${product.name}`}
                  >
                    <Plus size={18} /> {session ? "Adicionar" : "Faça login"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {count > 0 && (
        <Link
          href="/carrinho"
          className="fixed bottom-4 left-4 right-4 z-30 mx-auto flex max-w-md items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 font-bold text-cocoa shadow-soft sm:left-auto sm:right-6"
        >
          <ShoppingBag size={19} /> Ver carrinho
        </Link>
      )}
    </>
  );
}
