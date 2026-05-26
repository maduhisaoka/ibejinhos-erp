import { NextResponse } from "next/server";
import { isAdminPassword } from "@/lib/adminAuth";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  return isAdminPassword(request.headers.get("x-admin-password"));
}

function errorResponse(error: unknown, status = 400) {
  return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível concluir a ação." }, { status });
}

function emptyInventorySummary() {
  return {
    ingredients: [],
    products: [],
    productions: [],
    sales: [],
    movements: [],
    totalStockValue: 0,
    lowIngredients: [],
    averageProductCost: 0,
    topProducts: []
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
  }

  try {
    if (process.env.DATABASE_URL) {
      const { listPostgresInventorySummary } = await import("@/lib/inventoryPostgres");
      return NextResponse.json(await listPostgresInventorySummary());
    }
    const { listInventorySummary } = await import("@/lib/inventory");
    return NextResponse.json(listInventorySummary());
  } catch (error) {
    console.error("Falha ao carregar estoque.", error);
    return NextResponse.json(emptyInventorySummary());
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
  }

  const payload = await request.json();
  const action = String(payload.action ?? "");

  try {
    if (process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "As ações de estoque online ainda estão em atualização. Os dados já carregam para consulta na gestão." },
        { status: 503 }
      );
    }

    const inventory = await import("@/lib/inventory");

    if (action === "saveIngredient") {
      return NextResponse.json({ id: inventory.upsertIngredient(payload.ingredient) });
    }
    if (action === "deleteIngredient") {
      inventory.deleteIngredient(Number(payload.id));
      return NextResponse.json({ ok: true });
    }
    if (action === "ingredientEntry") {
      inventory.addIngredientEntry(payload.entry);
      return NextResponse.json({ ok: true });
    }
    if (action === "saveProduct") {
      return NextResponse.json({ id: inventory.upsertInventoryProduct(payload.product) });
    }
    if (action === "deleteProduct") {
      inventory.deleteInventoryProduct(Number(payload.id));
      return NextResponse.json({ ok: true });
    }
    if (action === "saveCard") {
      return NextResponse.json({ id: inventory.upsertTechnicalCard(payload.card) });
    }
    if (action === "deleteCard") {
      inventory.deleteTechnicalCard(Number(payload.productId));
      return NextResponse.json({ ok: true });
    }
    if (action === "production") {
      inventory.registerProduction(payload.production);
      return NextResponse.json({ ok: true });
    }
    if (action === "sale") {
      inventory.registerInventorySale(payload.sale);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
