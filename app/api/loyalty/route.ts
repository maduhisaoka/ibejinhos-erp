import { NextResponse } from "next/server";
import { getLoyaltySummary } from "@/lib/db";
import { isValidCpf } from "@/lib/format";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customerKey = searchParams.get("cpf") ?? searchParams.get("whatsapp") ?? "";
  if (searchParams.get("cpf") && !isValidCpf(customerKey)) {
    return NextResponse.json({ error: "CPF invalido." }, { status: 400 });
  }

  return NextResponse.json(getLoyaltySummary(customerKey));
}
