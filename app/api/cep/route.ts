import { NextResponse } from "next/server";
import { validateCep } from "@/lib/cep";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = await validateCep(searchParams.get("cep") ?? "");

  if (!address) {
    return NextResponse.json({ error: "CEP não encontrado." }, { status: 404 });
  }

  return NextResponse.json(address);
}
