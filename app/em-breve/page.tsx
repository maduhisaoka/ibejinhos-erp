import Image from "next/image";
import Link from "next/link";

export default function ComingSoonPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-76px)] max-w-4xl place-items-center px-4 py-12">
      <section className="text-center">
        <div className="mx-auto mb-6 grid h-28 w-28 place-items-center rounded-full bg-white/80 shadow-soft">
          <Image src="/brand/logo-cutout.png" alt="Ibejinhos" width={88} height={88} className="object-contain" />
        </div>
        <p className="text-sm font-black uppercase tracking-[0.22em] text-gold">Ibejinhos</p>
        <h1 className="mt-4 text-4xl font-black text-cocoa sm:text-6xl">Estamos preparando uma experiência doce para você.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-truffle">
          A loja online ainda não foi lançada oficialmente. Em breve o cardápio estará disponível para pedidos.
        </p>
        <Link href="/gestao" className="mt-8 inline-flex rounded-full bg-white px-5 py-3 text-sm font-black text-cocoa shadow-soft">
          Área da gestão
        </Link>
      </section>
    </main>
  );
}
