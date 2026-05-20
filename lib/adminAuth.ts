function cleanPassword(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  const withoutPrefix = normalized.startsWith("ADMIN_PASSWORD=")
    ? normalized.slice("ADMIN_PASSWORD=".length).trim()
    : normalized;

  return withoutPrefix.replace(/^["']|["']$/g, "").trim();
}

export function getAdminPassword() {
  return cleanPassword(process.env.ADMIN_PASSWORD) || "ibejinhos123";
}

export function isAdminPassword(value: string | null | undefined) {
  return cleanPassword(value) === getAdminPassword();
}
