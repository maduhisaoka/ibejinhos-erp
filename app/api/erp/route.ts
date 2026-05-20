import { NextResponse } from "next/server";
import { isAdminPassword } from "@/lib/adminAuth";
import { createErpExpense, getErpSummary, toggleExpensePaid, updateLoyaltyRules } from "@/lib/erp";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  return isAdminPassword(request.headers.get("x-admin-password"));
}

function errorResponse(error: unknown, status = 400) {
  return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível concluir a ação." }, { status });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
  }

  return NextResponse.json(await getErpSummary());
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
  }

  const payload = await request.json();
  const action = String(payload.action ?? "");

  try {
    if (action === "createExpense") {
      return NextResponse.json({ id: await createErpExpense(payload.expense) });
    }
    if (action === "toggleExpense") {
      await toggleExpensePaid(Number(payload.id), Boolean(payload.paid));
      return NextResponse.json({ ok: true });
    }
    if (action === "updateLoyalty") {
      await updateLoyaltyRules(payload.rules);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
