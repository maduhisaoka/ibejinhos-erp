import { NextResponse } from "next/server";
import { deleteCustomer, listCustomers } from "@/lib/db";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const password = request.headers.get("x-admin-password");
  return password && password === (process.env.ADMIN_PASSWORD ?? "ibejinhos123");
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha invalida." }, { status: 401 });
  }

  return NextResponse.json(listCustomers());
}

export async function DELETE(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha invalida." }, { status: 401 });
  }

  const payload = await request.json();
  const id = Number(payload.id);
  if (!id) {
    return NextResponse.json({ error: "Cliente invalido." }, { status: 400 });
  }

  deleteCustomer(id);
  return NextResponse.json({ ok: true });
}
