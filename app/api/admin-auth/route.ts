import { NextResponse } from "next/server";
import { isAdminPassword } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const password = request.headers.get("x-admin-password");

  if (!isAdminPassword(password)) {
    return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
