import { NextResponse } from "next/server";
import { isAdminPassword } from "@/lib/adminAuth";
import { updateOrderReceipt } from "@/lib/db";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  return isAdminPassword(request.headers.get("x-admin-password"));
}

function getExtension(file: File) {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 12) {
    return fromName.toLowerCase();
  }

  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "application/pdf") return "pdf";
  return "jpg";
}

function getMimeType(file: File) {
  if (file.type) return file.type;
  const extension = getExtension(file);
  if (extension === "pdf") return "application/pdf";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const type = String(formData.get("type") ?? "products");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = `data:${getMimeType(file)};base64,${buffer.toString("base64")}`;

  if (type === "receipts") {
    const orderId = Number(formData.get("orderId"));
    if (orderId) {
      await updateOrderReceipt(orderId, url);
    }
  }

  return NextResponse.json({ url });
}
