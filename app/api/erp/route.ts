import { NextResponse } from "next/server";
import { createErpExpense, getErpSummary, toggleExpensePaid, updateLoyaltyRules } from "@/lib/erp";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const password = request.headers.get("x-admin-password");
  return password && password === (process.env.ADMIN_PASSWORD ?? "ibejinhos123");
}

function errorResponse(error: unknown, status = 400) {
  return NextResponse.json({ error: error instanceof Error ? error.message : "Nao foi possivel concluir a acao." }, { status });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha invalida." }, { status: 401 });
  }

  return NextResponse.json(getErpSummary());
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha invalida." }, { status: 401 });
  }

  const payload = await request.json();
  const action = String(payload.action ?? "");

  try {
    if (action === "createExpense") {
      return NextResponse.json({ id: createErpExpense(payload.expense) });
    }
    if (action === "toggleExpense") {
      toggleExpensePaid(Number(payload.id), Boolean(payload.paid));
      return NextResponse.json({ ok: true });
    }
    if (action === "updateLoyalty") {
      updateLoyaltyRules(payload.rules);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acao invalida." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
