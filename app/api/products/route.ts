import { NextResponse } from "next/server";
import { isAdminPassword } from "@/lib/adminAuth";
import { listProducts, upsertProduct } from "@/lib/db";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  return isAdminPassword(request.headers.get("x-admin-password"));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("admin") === "true";
  try {
    return NextResponse.json(await listProducts(includeInactive));
  } catch (error) {
    console.error("Falha ao carregar produtos.", error);
    return NextResponse.json({ error: "Não foi possível carregar o cardápio." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
  }

  const payload = await request.json();

  if (!payload.name || !payload.description || !payload.image || Number(payload.price) <= 0) {
    return NextResponse.json({ error: "Preencha nome, descricao, imagem e preco." }, { status: 400 });
  }

  try {
    const id = await upsertProduct({
      id: payload.id ? Number(payload.id) : undefined,
      name: String(payload.name),
      description: String(payload.description),
      price: Number(payload.price),
      image: String(payload.image),
      active: Boolean(payload.active),
      flavorLimit: Number(payload.flavorLimit ?? 0),
      flavors: Array.isArray(payload.flavors) ? payload.flavors.map(String) : []
    });

    return NextResponse.json({ id });
  } catch (error) {
    console.error("Falha ao salvar produto.", error);
    return NextResponse.json({ error: "Não foi possível salvar o produto no cardápio." }, { status: 500 });
  }
}
