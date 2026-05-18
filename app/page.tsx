import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bike, Gift, MapPin } from "@/components/Icons";
import { orderScheduleMessage } from "@/lib/orderSchedule";

const highlights = [
  { icon: Gift, title: "Artesanal", text: "Brigadeiros, bolos e kits feitos com carinho." },
  { icon: Bike, title: "Entrega aos sábados", text: "Pedidos até quarta-feira às 18h para entrega no sábado." },
  { icon: MapPin, title: "Pedido simples", text: "Escolha seus doces e finalize pelo WhatsApp." }
];

export default function Home() {
  return (
    <main>
      <section className="mx-auto grid min-h-[calc(100vh-76px)] max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-[1fr_0.9fr]">
        <div className="max-w-2xl">
          <p className="mb-4 inline-flex rounded-full border border-gold/35 bg-white px-4 py-2 text-sm font-black text-truffle shadow-soft">
            Entrega em até 5 km de Moema
          </p>
          <h1 className="text-4xl font-bold leading-tight text-cocoa sm:text-6xl">
            Ibejinhos
          </h1>
          <p className="mt-5 text-xl leading-8 text-truffle">
            Docinhos feitos com carinho para adoçar seu dia. Brigadeiros cremosos,
            bolos aconchegantes e kits presenteáveis com sabor de abraço.
          </p>
          <p className="mt-4 rounded-lg border border-gold/25 bg-white/75 p-4 font-black leading-7 text-cocoa shadow-soft">
            {orderScheduleMessage}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/cliente"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-blush px-6 py-3 font-black text-white shadow-soft transition hover:bg-rose"
            >
              Entrar para comprar <ArrowRight size={18} />
            </Link>
            <Link
              href="/carrinho"
              className="inline-flex items-center justify-center rounded-full border border-truffle/20 bg-white px-6 py-3 font-black text-cocoa transition hover:bg-cream"
            >
              Finalizar pedido
            </Link>
          </div>
        </div>

        <div className="relative grid min-h-[380px] place-items-center">
          <Image
            src="/brand/logo-cutout.png"
            alt="Logo Ibejinhos"
            width={360}
            height={360}
            priority
            className="h-auto w-[78%] max-w-[390px] drop-shadow-2xl"
          />
        </div>
      </section>

      <section className="bg-cream/72 px-4 py-10">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          {highlights.map((item) => (
            <article key={item.title} className="rounded-lg border border-cocoa/10 bg-white/58 p-5">
              <item.icon className="mb-4 text-gold" size={28} />
              <h2 className="text-lg font-semibold text-cocoa">{item.title}</h2>
              <p className="mt-2 leading-6 text-truffle">{item.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
