import { NextResponse } from "next/server";
import { createOrder, deleteOrder, getCustomerByCpf, getLoyaltySummary, getStoreSettings, listOrders, makeOrderNumber, updateOrderDelivered, updateOrderNumber, updateOrderStatus } from "@/lib/db";
import { validateCep } from "@/lib/cep";
import { isBirthdayWeek } from "@/lib/coupons";
import { calculateDeliveryFee, isDeliveryAvailable } from "@/lib/delivery";
import { isValidCpf, normalizeCpf, onlyDigits } from "@/lib/format";
import { getClosedOrderMessage, isOrderWindowOpen } from "@/lib/orderSchedule";
import type { CartItem, PaymentMethod } from "@/lib/types";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const password = request.headers.get("x-admin-password");
  return password && password === (process.env.ADMIN_PASSWORD ?? "ibejinhos123");
}

function calculateSubtotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function getSelectedFlavorTotal(item: CartItem) {
  return Object.values(item.selectedFlavors ?? {}).reduce((sum, quantity) => sum + Number(quantity), 0);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha invalida." }, { status: 401 });
  }

  return NextResponse.json(listOrders());
}

export async function PATCH(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha invalida." }, { status: 401 });
  }

  const payload = await request.json();
  const id = Number(payload.id);
  const status = payload.status ? String(payload.status) : null;
  const delivered = typeof payload.delivered === "boolean" ? payload.delivered : null;

  if (!id) {
    return NextResponse.json({ error: "Pedido invalido." }, { status: 400 });
  }

  if (status) {
    if (!["preparando", "finalizado"].includes(status)) {
      return NextResponse.json({ error: "Status invalido." }, { status: 400 });
    }
    updateOrderStatus(id, status as "preparando" | "finalizado");
  }

  if (delivered !== null) {
    updateOrderDelivered(id, delivered);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha invalida." }, { status: 401 });
  }

  const payload = await request.json();
  const id = Number(payload.id);

  if (!id) {
    return NextResponse.json({ error: "Pedido invalido." }, { status: 400 });
  }

  deleteOrder(id);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const items = (payload.items ?? []) as CartItem[];
  const deliverySameAsRegistration = payload.deliverySameAsRegistration !== false;
  const deliveryStreet = deliverySameAsRegistration ? String(payload.registrationStreet ?? "") : String(payload.street ?? "");
  const deliveryNumber = deliverySameAsRegistration ? String(payload.registrationNumber ?? "") : String(payload.number ?? "");
  const deliveryComplement = deliverySameAsRegistration ? String(payload.registrationComplement ?? "") : String(payload.complement ?? "");
  const deliveryNeighborhood = deliverySameAsRegistration ? String(payload.registrationNeighborhood ?? "") : String(payload.neighborhood ?? "");
  const deliveryCep = deliverySameAsRegistration ? String(payload.registrationCep ?? "") : String(payload.cep ?? "");
  const birthdayDay = Number(payload.birthdayDay) || null;
  const birthdayMonth = Number(payload.birthdayMonth) || null;

  if (!items.length) {
    return NextResponse.json({ error: "Seu carrinho esta vazio." }, { status: 400 });
  }

  if (!isValidCpf(String(payload.cpf ?? ""))) {
    return NextResponse.json({ error: "Informe um CPF valido." }, { status: 400 });
  }

  const registeredCustomer = getCustomerByCpf(String(payload.cpf ?? ""));
  if (!registeredCustomer) {
    return NextResponse.json({ error: "Entre no cadastro antes de finalizar o pedido." }, { status: 400 });
  }

  if (!isOrderWindowOpen()) {
    return NextResponse.json({ error: getClosedOrderMessage() }, { status: 400 });
  }

  if (
    !String(payload.registrationStreet ?? "") ||
    !String(payload.registrationNumber ?? "") ||
    !String(payload.registrationNeighborhood ?? "") ||
    onlyDigits(String(payload.registrationCep ?? "")).length !== 8
  ) {
    return NextResponse.json({ error: "Preencha o endereco de cadastro." }, { status: 400 });
  }

  const registrationCepData = await validateCep(String(payload.registrationCep ?? ""));
  if (!registrationCepData) {
    return NextResponse.json({ error: "CEP de cadastro nao encontrado." }, { status: 400 });
  }

  if (!deliveryStreet || !deliveryNumber || !deliveryNeighborhood || onlyDigits(deliveryCep).length !== 8) {
    return NextResponse.json({ error: "Preencha o endereco de entrega." }, { status: 400 });
  }

  const deliveryCepData = await validateCep(deliveryCep);
  if (!deliveryCepData) {
    return NextResponse.json({ error: "CEP de entrega nao encontrado." }, { status: 400 });
  }
  const checkedDeliveryNeighborhood = deliveryCepData.neighborhood || deliveryNeighborhood;

  if (!isDeliveryAvailable(checkedDeliveryNeighborhood)) {
    return NextResponse.json(
      {
        error:
          "No momento, entregamos apenas em um raio de ate 5 km de Moema. Mas voce pode falar conosco pelo WhatsApp para consultar disponibilidade."
      },
      { status: 400 }
    );
  }

  for (const item of items) {
    const requiredFlavors = (item.flavorLimit ?? 0) * item.quantity;
    if (requiredFlavors > 0 && getSelectedFlavorTotal(item) !== requiredFlavors) {
      return NextResponse.json(
        { error: `Escolha ${requiredFlavors} sabor(es) para ${item.name}.` },
        { status: 400 }
      );
    }
  }

  const subtotal = calculateSubtotal(items);
  const settings = getStoreSettings();
  if (subtotal < settings.minimumOrderValue) {
    return NextResponse.json({ error: `O pedido minimo e de R$ ${settings.minimumOrderValue.toFixed(2).replace(".", ",")}.` }, { status: 400 });
  }

  const loyalty = getLoyaltySummary(String(payload.cpf));
  const deliveryEstimate = calculateDeliveryFee(checkedDeliveryNeighborhood, deliveryCep);
  const deliveryFee = loyalty.previousOrders === 0 ? 0 : deliveryEstimate.deliveryFee;
  const distanceKm = deliveryEstimate.distanceKm;
  const birthdayDiscountRate = isBirthdayWeek(birthdayDay, birthdayMonth) ? 0.15 : 0;
  const discountRate = Math.max(loyalty.discountRate, birthdayDiscountRate);
  const discount = Number((subtotal * discountRate).toFixed(2));
  const paymentMethod = String(payload.paymentMethod ?? "Pix") === "Credito" ? "Credito" : "Pix" as PaymentMethod;

  const id = createOrder({
    orderNumber: "",
    customerName: String(payload.name),
    cpf: normalizeCpf(String(payload.cpf)),
    whatsapp: String(payload.whatsapp),
    email: registeredCustomer.email,
    birthdayDay,
    birthdayMonth,
    registrationStreet: String(payload.registrationStreet),
    registrationNumber: String(payload.registrationNumber),
    registrationComplement: String(payload.registrationComplement ?? ""),
    registrationNeighborhood: String(payload.registrationNeighborhood),
    registrationCep: String(payload.registrationCep),
    deliverySameAsRegistration,
    recipientName: deliverySameAsRegistration ? String(payload.name) : String(payload.recipientName ?? ""),
    street: deliveryStreet,
    number: deliveryNumber,
    complement: deliveryComplement,
    neighborhood: checkedDeliveryNeighborhood,
    cep: deliveryCep,
    items,
    subtotal,
    deliveryDistanceKm: distanceKm,
    deliveryFee,
    discount,
    loyaltyOrderCount: loyalty.nextCycleOrderCount,
    total: subtotal + deliveryFee - discount,
    paymentMethod,
    receiptPath: null,
    status: "preparando",
    delivered: false
  });
  const orderNumber = makeOrderNumber(id);
  updateOrderNumber(id, orderNumber);

  return NextResponse.json({
    id,
    orderNumber,
    subtotal,
    deliveryFee,
    discount,
    loyalty,
    deliveryDistanceKm: distanceKm,
    total: subtotal + deliveryFee - discount
  });
}
