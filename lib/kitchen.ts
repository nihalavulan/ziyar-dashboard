import { randomBytes } from "crypto";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A long random key used in a kitchen person's private link. */
export function newWorkerToken() {
  return randomBytes(18).toString("base64url");
}

/** Clean rows sent from a page: keep named rows with a positive quantity. */
export function cleanRows(input: unknown) {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const rows: { name: string; qty: number; unit: string }[] = [];
  for (const r of input as any[]) {
    const name = typeof r?.name === "string" ? r.name.trim().slice(0, 80) : "";
    const qty = Number(r?.qty);
    const unit = typeof r?.unit === "string" && r.unit.trim() ? r.unit.trim().slice(0, 20) : "kg";
    if (!name || !Number.isFinite(qty) || qty <= 0) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ name, qty: Math.round(qty * 1000) / 1000, unit });
  }
  return rows;
}

/** Shape of a kitchen person sent to the /wn admin page. */
export const serializeWorker = (w: any, lastLog?: string | null) => ({
  id: String(w._id),
  name: w.name,
  role: w.role ?? "",
  token: w.token,
  items: (w.items ?? []).map((i: any) => ({
    name: i.name,
    unit: i.unit || "kg",
    stockItemId: i.stockItemId || "",
  })),
  lastSeenAt: w.lastSeenAt ?? null,
  lastLogDate: lastLog ?? null,
});
