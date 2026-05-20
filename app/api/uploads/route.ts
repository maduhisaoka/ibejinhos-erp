import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
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

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Senha invalida." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const type = String(formData.get("type") ?? "products");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo." }, { status: 400 });
  }

  const folder = type === "receipts" ? "receipts" : "products";
  const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(uploadDir, { recursive: true });

  const filename = `${randomUUID()}.${getExtension(file)}`;
  const fullPath = path.join(uploadDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);

  const url = `/uploads/${folder}/${filename}`;

  if (folder === "receipts") {
    const orderId = Number(formData.get("orderId"));
    if (orderId) {
      await updateOrderReceipt(orderId, url);
    }
  }

  return NextResponse.json({ url });
}
