import { NextResponse } from "next/server";
import { isAdminPassword } from "@/lib/adminAuth";
import { deleteCustomer, listCustomers } from "@/lib/db";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  return isAdminPassword(request.headers.get("x-admin-password"));
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
  }

  try {
    return NextResponse.json(await listCustomers());
  } catch (error) {
    console.error("Falha ao carregar clientes.", error);
    return NextResponse.json([]);
  }
}

export async function DELETE(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
  }

  const payload = await request.json();
  const id = Number(payload.id);
  if (!id) {
    return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  }

  try {
    await deleteCustomer(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Falha ao excluir cliente.", error);
    return NextResponse.json({ error: "Não foi possível excluir o cliente." }, { status: 500 });
  }
}
