import Image from "next/image";

export default function ComingSoonPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-76px)] max-w-4xl place-items-center px-4 py-12">
      <section className="text-center">
        <div className="mx-auto mb-6 grid h-28 w-28 place-items-center">
          <Image src="/brand/logo-cutout.png" alt="Ibejinhos" width={112} height={112} className="object-contain" priority />
        </div>
        <p className="text-sm font-black uppercase tracking-[0.22em] text-gold">Ibejinhos</p>
        <h1 className="mt-4 text-4xl font-black text-cocoa sm:text-6xl">Estamos preparando uma doce experiência para você.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-truffle">
          A loja online ainda não foi lançada oficialmente. Em breve o cardápio estará disponível para pedidos.
        </p>
      </section>
    </main>
  );
}
