"use client";

import Link from "next/link";
import { Minus, Plus, Send, Trash2 } from "@/components/Icons";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/CartContext";
import { getCustomerSession, type CustomerSession } from "@/lib/customerSession";
import { calculateDeliveryFee, isDeliveryAvailable } from "@/lib/delivery";
import { formatCep, formatCpf, formatCurrency, formatPhone, isValidCpf, normalizeCpf, onlyDigits } from "@/lib/format";
import {
  getClosedOrderMessage,
  getFormattedNextDeliveryDate,
  isOrderWindowOpen,
  isTestOrderAccessEnabled
} from "@/lib/orderSchedule";
import type { CartItem, Customer, LoyaltySummary, PaymentMethod, StoreSettings } from "@/lib/types";

const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "5511999999999";

const emptyCustomer: Customer = {
  name: "",
  cpf: "",
  password: "",
  email: "",
  whatsapp: "",
  birthdayDay: "",
  birthdayMonth: "",
  registrationStreet: "",
  registrationNumber: "",
  registrationComplement: "",
  registrationNeighborhood: "",
  registrationCep: "",
  deliverySameAsRegistration: true,
  recipientName: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  cep: ""
};

function paymentLabel(payment: PaymentMethod) {
  return payment === "Credito" ? "Crédito" : payment;
}

function isBirthdayWeek(dayValue: string, monthValue: string) {
  const day = Number(dayValue);
  const month = Number(monthValue);
  if (!day || !month) return false;

  const now = new Date();
  const start = new Date(now);
  const weekday = start.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + diff);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  const birthday = new Date(start.getFullYear(), month - 1, day);
  return birthday >= start && birthday <= end;
}

function FlavorSelector({ item }: { item: CartItem }) {
  const { updateItemFlavors } = useCart();
  const requiredTotal = item.flavorLimit * item.quantity;
  const selectedFlavors = item.selectedFlavors ?? {};
  const selectedTotal = Object.values(selectedFlavors).reduce((sum, quantity) => sum + quantity, 0);

  function setFlavorQuantity(flavor: string, nextQuantity: number) {
    const currentQuantity = selectedFlavors[flavor] ?? 0;
    const nextTotal = selectedTotal - currentQuantity + nextQuantity;
    if (nextTotal > requiredTotal || nextQuantity < 0) return;

    updateItemFlavors(item.id, {
      ...selectedFlavors,
      [flavor]: nextQuantity
    });
  }

  return (
    <div className="mt-4 rounded-lg bg-cream p-3">
      <p className="text-sm font-bold text-cocoa">
        Escolha {requiredTotal} sabor(es): {selectedTotal}/{requiredTotal}
      </p>
      <div className="mt-3 grid gap-2">
        {item.flavors.map((flavor) => {
          const quantity = selectedFlavors[flavor] ?? 0;
          return (
            <div key={flavor} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
              <span className="font-bold text-truffle">{flavor}</span>
              <div className="flex items-center gap-2">
                <button type="button" className="grid h-8 w-8 place-items-center rounded-full border border-cocoa/20" onClick={() => setFlavorQuantity(flavor, quantity - 1)}>
                  <Minus size={14} />
                </button>
                <span className="w-6 text-center font-black text-cocoa">{quantity}</span>
                <button type="button" className="grid h-8 w-8 place-items-center rounded-full bg-cocoa text-cream" onClick={() => setFlavorQuantity(flavor, quantity + 1)}>
                  <Plus size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CarrinhoPage() {
  const { items, subtotal, updateQuantity, removeItem, clearCart } = useCart();
  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Pix");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [loyalty, setLoyalty] = useState<LoyaltySummary | null>(null);
  const [settings, setSettings] = useState<StoreSettings>({ minimumOrderValue: 0 });
  const orderWindowOpen = isOrderWindowOpen();
  const testOrdersEnabled = isTestOrderAccessEnabled();
  const nextDeliveryDate = getFormattedNextDeliveryDate();
  const deliveryAddress = customer.deliverySameAsRegistration
    ? {
        street: customer.registrationStreet,
        number: customer.registrationNumber,
        complement: customer.registrationComplement,
        neighborhood: customer.registrationNeighborhood,
        cep: customer.registrationCep
      }
    : {
        street: customer.street,
        number: customer.number,
        complement: customer.complement,
        neighborhood: customer.neighborhood,
        cep: customer.cep
      };

  const deliveryAvailable = useMemo(
    () => (deliveryAddress.neighborhood ? isDeliveryAvailable(deliveryAddress.neighborhood) : true),
    [deliveryAddress.neighborhood]
  );
  const deliveryEstimate = useMemo(
    () => (deliveryAddress.neighborhood && deliveryAvailable ? calculateDeliveryFee(deliveryAddress.neighborhood, deliveryAddress.cep) : null),
    [deliveryAddress.neighborhood, deliveryAddress.cep, deliveryAvailable]
  );
  const firstOrderFreeDelivery = Boolean(loyalty && loyalty.previousOrders === 0);
  const deliveryFee = firstOrderFreeDelivery ? 0 : deliveryEstimate?.deliveryFee ?? 0;
  const birthdayDiscountRate = isBirthdayWeek(customer.birthdayDay, customer.birthdayMonth) ? 0.15 : 0;
  const discountRate = Math.max(loyalty?.discountRate ?? 0, birthdayDiscountRate);
  const discount = Number((subtotal * discountRate).toFixed(2));
  const total = subtotal + deliveryFee - discount;
  const missingMinimum = subtotal < settings.minimumOrderValue;

  useEffect(() => {
    fetch("/api/settings")
      .then((response) => response.json())
      .then((data: StoreSettings) => setSettings(data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const current = getCustomerSession();
    setSession(current);
    if (current) {
      setCustomer((previous) => ({
        ...previous,
        name: current.name,
        cpf: formatCpf(current.cpf),
        email: current.email,
        whatsapp: current.whatsapp,
        birthdayDay: current.birthdayDay ? String(current.birthdayDay) : "",
        birthdayMonth: current.birthdayMonth ? String(current.birthdayMonth) : "",
        registrationStreet: current.street,
        registrationNumber: current.number,
        registrationComplement: current.complement,
        registrationNeighborhood: current.neighborhood,
        registrationCep: current.cep
      }));
    }
  }, []);

  useEffect(() => {
    const cpf = normalizeCpf(customer.cpf);
    if (!isValidCpf(cpf)) {
      setLoyalty(null);
      return;
    }

    const controller = new AbortController();
    fetch(`/api/loyalty?cpf=${encodeURIComponent(cpf)}`, {
      signal: controller.signal
    })
      .then((response) => response.json())
      .then((data: LoyaltySummary) => setLoyalty(data))
      .catch(() => undefined);

    return () => controller.abort();
  }, [customer.cpf]);

  async function lookupCep(cep: string, target: "registration" | "delivery") {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) return;

    setCepLoading(true);
    try {
      const response = await fetch(`/api/cep?cep=${digits}`);
      const data = await response.json();
      if (response.ok) {
        setCustomer((current) => ({
          ...current,
          ...(target === "registration"
            ? {
                registrationStreet: data.street || current.registrationStreet,
                registrationNeighborhood: data.neighborhood || current.registrationNeighborhood,
                registrationCep: formatCep(digits)
              }
            : {
                street: data.street || current.street,
                neighborhood: data.neighborhood || current.neighborhood,
                cep: formatCep(digits)
              })
        }));
      } else {
        setError("CEP não encontrado. Confira os números digitados.");
      }
    } catch {
      setError("Não foi possível buscar o CEP agora. Preencha o endereço manualmente.");
    } finally {
      setCepLoading(false);
    }
  }

  function updateCustomer(field: keyof Customer, value: string) {
    const formattedValue =
      field === "whatsapp"
        ? formatPhone(value)
        : field === "cep" || field === "registrationCep"
          ? formatCep(value)
          : field === "cpf"
            ? formatCpf(value)
            : value;
    setCustomer((current) => ({ ...current, [field]: formattedValue }));
  }

  function buildWhatsAppMessage(orderId?: number | string) {
    const lines = [
      "Olá, Ibejinhos! Quero finalizar meu pedido:",
      orderId ? `Pedido ${orderId}` : "",
      "",
      `Nome: ${customer.name}`,
      `CPF: ${customer.cpf}`,
      `WhatsApp: ${customer.whatsapp}`,
      !customer.deliverySameAsRegistration ? `Para: ${customer.recipientName}` : "",
      `Endereço de entrega: ${deliveryAddress.street}, ${deliveryAddress.number}${deliveryAddress.complement ? ` - ${deliveryAddress.complement}` : ""}`,
      `Bairro: ${deliveryAddress.neighborhood}`,
      `CEP: ${deliveryAddress.cep}`,
      !customer.deliverySameAsRegistration
        ? `Endereço de cadastro: ${customer.registrationStreet}, ${customer.registrationNumber}${customer.registrationComplement ? ` - ${customer.registrationComplement}` : ""}, ${customer.registrationNeighborhood} - ${customer.registrationCep}`
        : "",
      `Entrega prevista: ${nextDeliveryDate}`,
      deliveryEstimate?.distanceKm ? `Frete calculado para o endereço informado.` : "",
      "",
      "Itens:",
      ...items.flatMap((item) => {
        const flavorLines = Object.entries(item.selectedFlavors ?? {})
          .filter(([, quantity]) => quantity > 0)
          .map(([flavor, quantity]) => `  Sabores: ${quantity}x ${flavor}`);
        return [`- ${item.quantity}x ${item.name} (${formatCurrency(item.price * item.quantity)})`, ...flavorLines];
      }),
      "",
      `Subtotal: ${formatCurrency(subtotal)}`,
      discount > 0 ? `Desconto fidelidade: -${formatCurrency(discount)}` : "",
      firstOrderFreeDelivery ? "Taxa de entrega: grátis no primeiro pedido" : `Taxa de entrega: ${formatCurrency(deliveryFee)}`,
      `Total: ${formatCurrency(total)}`,
      `Pagamento: ${paymentLabel(paymentMethod)}`
    ].filter(Boolean);

    return lines.join("\n");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!items.length) {
      setError("Seu carrinho está vazio.");
      return;
    }

    if (!session) {
      setError("Entre ou faça seu cadastro antes de finalizar.");
      return;
    }

    if (missingMinimum) {
      setError(`O pedido mínimo é de ${formatCurrency(settings.minimumOrderValue)}.`);
      return;
    }

    if (!orderWindowOpen) {
      setError(getClosedOrderMessage());
      return;
    }

    if (!deliveryAvailable) {
      setError(
        "No momento, entregamos apenas em um raio de até 5 km de Moema. Mas você pode falar conosco pelo WhatsApp para consultar disponibilidade."
      );
      return;
    }

    if (
      !customer.name ||
      !isValidCpf(customer.cpf) ||
      !customer.email ||
      !customer.whatsapp ||
      !customer.birthdayDay ||
      !customer.birthdayMonth ||
      !customer.registrationStreet ||
      !customer.registrationNumber ||
      !customer.registrationNeighborhood ||
      onlyDigits(customer.registrationCep).length !== 8
    ) {
      setError("Preencha seus dados de cadastro para finalizar.");
      return;
    }

    if (!customer.deliverySameAsRegistration && !customer.recipientName) {
      setError("Informe para quem é a encomenda.");
      return;
    }

    if (!deliveryAddress.street || !deliveryAddress.number || !deliveryAddress.neighborhood || onlyDigits(deliveryAddress.cep).length !== 8) {
      setError("Preencha o endereço de entrega para finalizar.");
      return;
    }

    for (const item of items) {
      const requiredFlavors = (item.flavorLimit ?? 0) * item.quantity;
      const selectedTotal = Object.values(item.selectedFlavors ?? {}).reduce((sum, quantity) => sum + quantity, 0);
      if (requiredFlavors > 0 && selectedTotal !== requiredFlavors) {
        setError(`Escolha ${requiredFlavors} sabor(es) para ${item.name}.`);
        return;
      }
    }

    setLoading(true);
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...customer, paymentMethod, items })
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Não foi possível finalizar o pedido.");
      return;
    }

    const url = `https://wa.me/${onlyDigits(whatsappNumber)}?text=${encodeURIComponent(buildWhatsAppMessage(data.orderNumber ?? data.id))}`;
    clearCart();
    setSuccessMessage("Seu pedido já foi realizado. A Ibejinhos entrará em contato para confirmação do pedido.");
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_420px]">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">Carrinho</p>
        <h1 className="mt-3 text-3xl font-bold text-cocoa sm:text-5xl">Seu pedido</h1>

        {items.length === 0 ? (
          <div className="mt-8 rounded-lg border border-cocoa/10 bg-white/70 p-6">
            <p className="text-truffle">Seu carrinho está vazio por enquanto.</p>
            <Link className="mt-4 inline-flex rounded-full bg-cocoa px-5 py-3 font-semibold text-cream" href="/cardapio">
              Ver cardápio
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {items.map((item) => (
              <article key={item.id} className="flex gap-4 rounded-lg border border-cocoa/10 bg-white/72 p-4 shadow-soft">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-cocoa">{item.name}</h2>
                  <p className="mt-1 text-sm text-truffle">{formatCurrency(item.price)} cada</p>
                  <strong className="mt-2 block text-gold">{formatCurrency(item.price * item.quantity)}</strong>
                  {(item.flavorLimit ?? 0) > 0 && (
                    <FlavorSelector item={item} />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button className="grid h-9 w-9 place-items-center rounded-full border border-cocoa/20" onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label="Diminuir quantidade">
                    <Minus size={16} />
                  </button>
                  <span className="w-6 text-center font-semibold">{item.quantity}</span>
                  <button className="grid h-9 w-9 place-items-center rounded-full border border-cocoa/20" onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label="Aumentar quantidade">
                    <Plus size={16} />
                  </button>
                  <button className="grid h-9 w-9 place-items-center rounded-full bg-blush text-cocoa" onClick={() => removeItem(item.id)} aria-label="Remover item">
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className="h-fit rounded-lg border border-cocoa/10 bg-white/78 p-5 shadow-soft">
        <h2 className="text-xl font-bold text-cocoa">Entrega e pagamento</h2>
        {!orderWindowOpen && (
          <p className="mt-3 rounded-lg bg-blush/70 p-3 text-sm font-bold leading-6 text-cocoa">
            {getClosedOrderMessage()}
          </p>
        )}
        {testOrdersEnabled && (
          <p className="mt-3 rounded-lg bg-white p-3 text-sm font-bold leading-6 text-cocoa">
            Modo de teste ativo: pedidos liberados temporariamente.
          </p>
        )}

        {!session && (
          <div className="mt-5 rounded-lg bg-blush/70 p-4 text-sm font-bold leading-6 text-cocoa">
            Entre ou faça seu cadastro antes de finalizar. <Link className="underline" href="/cliente">Ir para cadastro</Link>
          </div>
        )}

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          {session && (
            <div className="rounded-lg bg-white p-3 text-sm font-bold leading-6 text-cocoa">
              Comprando como {session.name}<br />
              {session.email} - {session.whatsapp}
            </div>
          )}
          {firstOrderFreeDelivery && (
            <p className="rounded-lg bg-white p-3 text-sm font-bold leading-6 text-cocoa">
              Primeiro pedido: frete grátis aplicado.
            </p>
          )}
          {birthdayDiscountRate > 0 && (
            <p className="rounded-lg bg-white p-3 text-sm font-bold leading-6 text-cocoa">
              Cupom de aniversário ativo: 15% de desconto nesta semana.
            </p>
          )}
          <label className="flex items-start gap-3 rounded-lg bg-cream p-3 text-sm font-bold leading-6 text-cocoa">
            <input
              className="mt-1"
              type="checkbox"
              checked={customer.deliverySameAsRegistration}
              onChange={(event) => setCustomer((current) => ({ ...current, deliverySameAsRegistration: event.target.checked }))}
            />
            O endereço de entrega é o mesmo do cadastro
          </label>
          {!customer.deliverySameAsRegistration && (
            <div className="space-y-3 rounded-lg border border-cocoa/10 bg-white p-3">
              <input required className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Nome de quem vai receber" value={customer.recipientName} onChange={(event) => updateCustomer("recipientName", event.target.value)} />
              <div className="text-sm font-bold text-cocoa">Endereço de entrega</div>
              <input required className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="CEP da entrega" value={customer.cep} onChange={(event) => updateCustomer("cep", event.target.value)} onBlur={(event) => lookupCep(event.target.value, "delivery")} />
              <input required className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Logradouro da entrega" value={customer.street} onChange={(event) => updateCustomer("street", event.target.value)} />
              <input required className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Número da entrega" value={customer.number} onChange={(event) => updateCustomer("number", event.target.value)} />
              <input className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Complemento da entrega" value={customer.complement} onChange={(event) => updateCustomer("complement", event.target.value)} />
              <input required className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" placeholder="Bairro da entrega" value={customer.neighborhood} onChange={(event) => updateCustomer("neighborhood", event.target.value)} />
            </div>
          )}
          {!deliveryAvailable && (
            <p className="rounded-lg bg-blush/70 p-3 text-sm leading-6 text-cocoa">
              No momento, entregamos apenas em um raio de até 5 km de Moema. Mas você pode falar conosco pelo WhatsApp para consultar disponibilidade.
            </p>
          )}
          <select className="w-full rounded-lg border border-cocoa/15 bg-cream px-4 py-3" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
            <option value="Pix">Pix</option>
            <option value="Credito">Crédito</option>
          </select>

          <div className="space-y-2 border-t border-cocoa/10 pt-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
            {settings.minimumOrderValue > 0 && (
              <div className={missingMinimum ? "flex justify-between text-blush" : "flex justify-between text-truffle"}>
                <span>Pedido mínimo</span><strong>{formatCurrency(settings.minimumOrderValue)}</strong>
              </div>
            )}
            {discount > 0 && <div className="flex justify-between text-blush"><span>{birthdayDiscountRate > 0 ? "Desconto aniversário" : "Desconto fidelidade"}</span><strong>-{formatCurrency(discount)}</strong></div>}
            <div className="flex justify-between">
              <span>Taxa de entrega</span>
              <strong>{deliveryAddress.neighborhood && deliveryAvailable ? firstOrderFreeDelivery ? "Gratis" : formatCurrency(deliveryFee) : "Informe o bairro"}</strong>
            </div>
            <div className="flex justify-between text-lg text-cocoa"><span>Total</span><strong>{formatCurrency(total)}</strong></div>
          </div>

          {error && <p className="rounded-lg bg-blush p-3 text-sm text-cocoa">{error}</p>}
          {successMessage && <p className="rounded-lg bg-white p-3 text-sm font-bold text-cocoa">{successMessage}</p>}

          <button disabled={loading || !items.length || !orderWindowOpen || missingMinimum || !session} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cocoa px-5 py-3 font-bold text-cream hover:bg-truffle disabled:opacity-60">
            <Send size={18} /> {loading ? "Preparando..." : "Finalizar pelo WhatsApp"}
          </button>
        </form>
      </aside>
    </main>
  );
}
