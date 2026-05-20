import { ProductGrid } from "@/components/ProductGrid";
import { listProducts } from "@/lib/db";
import { seedProducts } from "@/lib/products";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

function fallbackProducts(): Product[] {
  return seedProducts.map((product, index) => ({ id: index + 1, ...product }));
}

export default async function CardapioPage() {
  let products = fallbackProducts();

  try {
    const dbProducts = await listProducts();
    if (dbProducts.length > 0) {
      products = dbProducts;
    }
  } catch (error) {
    console.error("Nao foi possivel carregar produtos do banco.", error);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">Cardápio</p>
        <h1 className="mt-3 text-3xl font-bold text-cocoa sm:text-5xl">Escolha seus Ibejinhos favoritos</h1>
        <p className="mt-4 leading-7 text-truffle">
          Brigadeiros, bolos e kits preparados em pequena escala, com jeitinho artesanal e entrega em Moema e bairros próximos.
        </p>
      </div>
      <ProductGrid products={products} />
    </main>
  );
}
