import { NextResponse } from "next/server";
import { isAdminPassword } from "@/lib/adminAuth";
import {
  addIngredientEntry,
  deleteIngredient,
  deleteInventoryProduct,
  deleteTechnicalCard,
  listInventorySummary,
  registerInventorySale,
  registerProduction,
  upsertIngredient,
  upsertInventoryProduct,
  upsertTechnicalCard
} from "@/lib/inventory";

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

  try {
    return NextResponse.json(listInventorySummary());
  } catch (error) {
    console.error("Falha ao carregar estoque.", error);
    return NextResponse.json({
      ingredients: [],
      products: [],
      productions: [],
      sales: [],
      movements: [],
      totalStockValue: 0,
      lowIngredients: [],
      averageProductCost: 0,
      topProducts: []
    });
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
  }

  const payload = await request.json();
  const action = String(payload.action ?? "");

  try {
    if (action === "saveIngredient") {
      return NextResponse.json({ id: upsertIngredient(payload.ingredient) });
    }
    if (action === "deleteIngredient") {
      deleteIngredient(Number(payload.id));
      return NextResponse.json({ ok: true });
    }
    if (action === "ingredientEntry") {
      addIngredientEntry(payload.entry);
      return NextResponse.json({ ok: true });
    }
    if (action === "saveProduct") {
      return NextResponse.json({ id: upsertInventoryProduct(payload.product) });
    }
    if (action === "deleteProduct") {
      deleteInventoryProduct(Number(payload.id));
      return NextResponse.json({ ok: true });
    }
    if (action === "saveCard") {
      return NextResponse.json({ id: upsertTechnicalCard(payload.card) });
    }
    if (action === "deleteCard") {
      deleteTechnicalCard(Number(payload.productId));
      return NextResponse.json({ ok: true });
    }
    if (action === "production") {
      registerProduction(payload.production);
      return NextResponse.json({ ok: true });
    }
    if (action === "sale") {
      registerInventorySale(payload.sale);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
