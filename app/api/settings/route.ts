import { NextResponse } from "next/server";
import { getStoreSettings, updateStoreSettings } from "@/lib/db";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const password = request.headers.get("x-admin-password");
  return password && password === (process.env.ADMIN_PASSWORD ?? "ibejinhos123");
}

export async function GET() {
  return NextResponse.json(getStoreSettings());
}

export async function PATCH(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha invalida." }, { status: 401 });
  }

  const payload = await request.json();
  updateStoreSettings({
    minimumOrderValue: Math.max(0, Number(payload.minimumOrderValue ?? 0))
  });

  return NextResponse.json(getStoreSettings());
}
