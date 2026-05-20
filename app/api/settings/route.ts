import { NextResponse } from "next/server";
import { isAdminPassword } from "@/lib/adminAuth";
import { getStoreSettings, updateStoreSettings } from "@/lib/db";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  return isAdminPassword(request.headers.get("x-admin-password"));
}

export async function GET() {
  return NextResponse.json(await getStoreSettings());
}

export async function PATCH(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
  }

  const payload = await request.json();
  await updateStoreSettings({
    minimumOrderValue: Math.max(0, Number(payload.minimumOrderValue ?? 0))
  });

  return NextResponse.json(await getStoreSettings());
}
