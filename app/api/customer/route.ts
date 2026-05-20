import { NextResponse } from "next/server";
import { getCustomerByCpf, getLoyaltySummary, listOrdersByCpf, resetCustomerPassword, upsertCustomer, verifyCustomerPassword } from "@/lib/db";
import { validateCep } from "@/lib/cep";
import { isBirthdayWeek } from "@/lib/coupons";
import { isStrongPassword, isValidCpf, isValidEmail, normalizeCpf } from "@/lib/format";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cpf = normalizeCpf(searchParams.get("cpf") ?? "");
  const password = searchParams.get("password") ?? "";

  if (!isValidCpf(cpf)) {
    return NextResponse.json({ error: "Informe um CPF valido." }, { status: 400 });
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
}

export async function POST(request: Request) {
  const payload = await request.json();
  const cpf = normalizeCpf(String(payload.cpf ?? ""));
  const password = String(payload.password ?? "");
  const email = String(payload.email ?? "").trim();
  const cepData = await validateCep(String(payload.cep ?? ""));

  if (!isValidCpf(cpf)) {
    return NextResponse.json({ error: "Informe um CPF valido." }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Informe um e-mail valido." }, { status: 400 });
  }

  if (!isStrongPassword(password)) {
    return NextResponse.json({ error: "A senha precisa ter pelo menos 8 caracteres, numero e caractere especial." }, { status: 400 });
  }

  if (!cepData) {
    return NextResponse.json({ error: "CEP nao encontrado." }, { status: 400 });
  }

  if (!String(payload.name ?? "") || !String(payload.whatsapp ?? "") || !String(payload.number ?? "")) {
    return NextResponse.json({ error: "Preencha os dados obrigatorios." }, { status: 400 });
  }

  await upsertCustomer({
    name: String(payload.name),
    cpf,
    password,
    email,
    whatsapp: String(payload.whatsapp),
    birthdayDay: Number(payload.birthdayDay) || null,
    birthdayMonth: Number(payload.birthdayMonth) || null,
    street: String(payload.street || cepData.street),
    number: String(payload.number),
    complement: String(payload.complement ?? ""),
    neighborhood: String(payload.neighborhood || cepData.neighborhood),
    cep: String(payload.cep)
  });

  return NextResponse.json({ customer: await getCustomerByCpf(cpf) });
}

function makeTemporaryPassword() {
  const number = Math.floor(1000 + Math.random() * 9000);
  return `Ibejinhos#${number}`;
}

export async function PATCH(request: Request) {
  const payload = await request.json();
  const cpf = normalizeCpf(String(payload.cpf ?? ""));
  const email = String(payload.email ?? "").trim();

  if (!isValidCpf(cpf) || !isValidEmail(email)) {
    return NextResponse.json({ error: "Informe CPF e e-mail validos." }, { status: 400 });
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
}
