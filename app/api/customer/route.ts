import { NextResponse } from "next/server";
import { getCustomerByCpf, getLoyaltySummary, listOrdersByCpf, resetCustomerPassword, upsertCustomer, verifyCustomerPassword } from "@/lib/db";
import { validateCep } from "@/lib/cep";
import { isBirthdayWeek } from "@/lib/coupons";
import { isStrongPassword, isValidEmail, normalizeCpf, onlyDigits } from "@/lib/format";
import type { RegisteredCustomer } from "@/lib/types";

export const runtime = "nodejs";

function isUsableCpf(value: string) {
  const cpf = onlyDigits(value);
  return cpf.length === 11 && !/^(\d)\1{10}$/.test(cpf);
}

function buildCustomerFromPayload(payload: Record<string, unknown>, cpf: string, email: string): RegisteredCustomer {
  return {
    id: Date.now(),
    name: String(payload.name ?? "").trim(),
    cpf,
    whatsapp: String(payload.whatsapp ?? "").trim(),
    email,
    birthdayDay: Number(payload.birthdayDay) || null,
    birthdayMonth: Number(payload.birthdayMonth) || null,
    street: String(payload.street ?? "").trim(),
    number: String(payload.number ?? "").trim(),
    complement: String(payload.complement ?? "").trim(),
    neighborhood: String(payload.neighborhood ?? "").trim(),
    cep: String(payload.cep ?? "").trim(),
    createdAt: new Date().toISOString()
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cpf = normalizeCpf(searchParams.get("cpf") ?? "");
    const password = searchParams.get("password") ?? "";

    if (!isUsableCpf(cpf)) {
      return NextResponse.json({ error: "Informe um CPF válido." }, { status: 400 });
    }

    if (!(await verifyCustomerPassword(cpf, password))) {
      return NextResponse.json({ error: "CPF ou senha incorretos." }, { status: 401 });
    }

    const customer = await getCustomerByCpf(cpf);

    return NextResponse.json({
      customer,
      birthdayCouponAvailable: customer ? isBirthdayWeek(customer.birthdayDay, customer.birthdayMonth) : false,
      loyalty: await getLoyaltySummary(cpf),
      orders: await listOrdersByCpf(cpf)
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar seus dados agora." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const cpf = normalizeCpf(String(payload.cpf ?? ""));
    const password = String(payload.password ?? "");
    const email = String(payload.email ?? "").trim();

    if (!isUsableCpf(cpf)) {
      return NextResponse.json({ error: "Informe um CPF válido." }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }

    if (!isStrongPassword(password)) {
      return NextResponse.json({ error: "A senha precisa ter pelo menos 8 caracteres, número e caractere especial." }, { status: 400 });
    }

    if (!String(payload.name ?? "").trim() || !String(payload.whatsapp ?? "").trim() || !String(payload.number ?? "").trim()) {
      return NextResponse.json({ error: "Preencha os dados obrigatórios." }, { status: 400 });
    }

    const cepData = await validateCep(String(payload.cep ?? ""));
    const street = String(payload.street || cepData?.street || "").trim();
    const neighborhood = String(payload.neighborhood || cepData?.neighborhood || "").trim();

    if (!street || !neighborhood) {
      return NextResponse.json({ error: "Preencha o endereço completo." }, { status: 400 });
    }

    const customerData = {
      name: String(payload.name).trim(),
      cpf,
      password,
      email,
      whatsapp: String(payload.whatsapp).trim(),
      birthdayDay: Number(payload.birthdayDay) || null,
      birthdayMonth: Number(payload.birthdayMonth) || null,
      street,
      number: String(payload.number).trim(),
      complement: String(payload.complement ?? "").trim(),
      neighborhood,
      cep: String(payload.cep)
    };

    try {
      await upsertCustomer(customerData);
      return NextResponse.json({ customer: await getCustomerByCpf(cpf) });
    } catch (error) {
      console.error("Falha ao salvar cliente no banco.", error);
      return NextResponse.json({
        customer: buildCustomerFromPayload({ ...payload, street, neighborhood }, cpf, email),
        birthdayCouponAvailable: false,
        loyalty: {
          previousOrders: 0,
          currentOrderCount: 1,
          cycleOrderCount: 0,
          nextCycleOrderCount: 1,
          qualifiesForDiscount: false,
          ordersUntilDiscount: 10,
          discountRate: 0,
          rewardLabel: "Cartão Doce Ibejinhos",
          rewardDescription: "A cada 10 pedidos, o próximo pedido recebe 10% de desconto. Depois de usar o mimo, a contagem recomeça."
        },
        orders: [],
        databaseSaved: false
      });
    }
  } catch {
    return NextResponse.json({ error: "Não foi possível concluir o cadastro agora." }, { status: 500 });
  }
}

function makeTemporaryPassword() {
  const number = Math.floor(1000 + Math.random() * 9000);
  return `Ibejinhos#${number}`;
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json();
    const cpf = normalizeCpf(String(payload.cpf ?? ""));
    const email = String(payload.email ?? "").trim();

    if (!isUsableCpf(cpf) || !isValidEmail(email)) {
      return NextResponse.json({ error: "Informe CPF e e-mail válidos." }, { status: 400 });
    }

    const temporaryPassword = makeTemporaryPassword();
    const updated = await resetCustomerPassword(cpf, email, temporaryPassword);

    if (!updated) {
      return NextResponse.json({ error: "Não encontramos cadastro com este CPF e e-mail." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      message: "Enviamos uma senha temporária para o e-mail cadastrado.",
      temporaryPassword
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível recuperar a senha agora." }, { status: 500 });
  }
}
