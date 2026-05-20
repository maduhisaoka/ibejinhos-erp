"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ShoppingBag } from "@/components/Icons";
import { useCart } from "@/components/CartContext";
import { adminPasswordKey, adminUnlockedKey } from "@/lib/adminSession";

export function Header() {
  const { count } = useCart();
  const pathname = usePathname();
  const isAdminArea = pathname.startsWith("/gestao") || pathname.startsWith("/admin") || pathname.startsWith("/estoque") || pathname.startsWith("/erp");
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  useEffect(() => {
    function syncAdminAccess() {
      setAdminUnlocked(window.localStorage.getItem(adminUnlockedKey) === "true" || Boolean(window.localStorage.getItem(adminPasswordKey)));
    }

    syncAdminAccess();
    window.addEventListener("storage", syncAdminAccess);
    window.addEventListener("ibejinhos-admin-auth-changed", syncAdminAccess);

    return () => {
      window.removeEventListener("storage", syncAdminAccess);
      window.removeEventListener("ibejinhos-admin-auth-changed", syncAdminAccess);
    };
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-cocoa/10 bg-cream/92 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3 text-cocoa">
          <span className="relative h-12 w-12">
            <Image src="/brand/logo-cutout.png" alt="Logo Ibejinhos" fill className="object-contain" />
          </span>
          <span>
            <span className="block text-xl font-black leading-none tracking-wide">Ibejinhos</span>
            <span className="text-xs font-semibold text-truffle">doces artesanais</span>
          </span>
        </Link>

        {isAdminArea && adminUnlocked ? (
          <nav className="flex items-center gap-2 text-sm font-medium text-cocoa">
            <Link className="rounded-full px-3 py-2 hover:bg-blush/55" href="/gestao">
              Central
            </Link>
            <Link className="rounded-full px-3 py-2 hover:bg-blush/55" href="/admin">
              Pedidos
            </Link>
            <Link className="rounded-full px-3 py-2 hover:bg-blush/55" href="/estoque">
              Estoque
            </Link>
            <Link className="rounded-full px-3 py-2 hover:bg-blush/55" href="/erp">
              ERP
            </Link>
            <Link className="rounded-full px-3 py-2 hover:bg-blush/55" href="/">
              Ver loja
            </Link>
          </nav>
        ) : isAdminArea ? (
          <nav className="flex items-center gap-2 text-sm font-medium text-cocoa">
            <Link className="rounded-full px-3 py-2 hover:bg-blush/55" href="/">
              Ver loja
            </Link>
          </nav>
        ) : (
          <nav className="flex items-center gap-2 text-sm font-medium text-cocoa">
            <Link className="rounded-full px-3 py-2 hover:bg-blush/55" href="/cardapio">
              Cardápio
            </Link>
            <Link className="rounded-full px-3 py-2 hover:bg-blush/55" href="/cliente">
              Meus pedidos
            </Link>
            <Link
              className="relative grid h-10 w-10 place-items-center rounded-full bg-cocoa text-cream shadow-soft"
              href="/carrinho"
              aria-label="Abrir carrinho"
            >
              <ShoppingBag size={19} />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-xs text-cocoa">
                  {count}
                </span>
              )}
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
