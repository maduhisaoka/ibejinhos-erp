import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const password = request.headers.get("x-admin-password");
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "ibejinhos123";

  if (!password || password !== expectedPassword) {
    return NextResponse.json({ error: "Senha invalida." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
