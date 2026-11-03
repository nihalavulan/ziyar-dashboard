/** Shared masala maths, used by the server and the pages. */

export interface MasalaRow {
  name: string;
  qty: number;
  unit: string;
  rate: number;
}

export interface Masala {
  id: string;
  name: string;
  rows: MasalaRow[];
  yieldQty: number;
  yieldUnit: string; // "kg" or "L"
}

/** Total cost of one batch. */
export const masalaBatchCost = (m: Pick<Masala, "rows">) =>
  m.rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.rate) || 0), 0);

/** Cost of 1 kg (or 1 L) of the masala; 0 when the batch size isn't set. */
export const masalaCostPerYieldUnit = (m: Pick<Masala, "rows" | "yieldQty">) =>
  m.yieldQty > 0 ? masalaBatchCost(m) / m.yieldQty : 0;

/** Units a masala can be measured in when used, and how many of each make one kg/L. */
export function masalaUnits(yieldUnit: string): { unit: string; perYield: number }[] {
  return yieldUnit === "L"
    ? [
        { unit: "L", perYield: 1 },
        { unit: "ml", perYield: 1000 },
      ]
    : [
        { unit: "kg", perYield: 1 },
        { unit: "g", perYield: 1000 },
      ];
}

/** Rate for one `unit` of the masala (e.g. per g), rounded to paise-and-a-bit. */
export function masalaRate(m: Masala, unit: string) {
  const u = masalaUnits(m.yieldUnit).find((x) => x.unit === unit) ?? masalaUnits(m.yieldUnit)[0];
  return Math.round((masalaCostPerYieldUnit(m) / u.perYield) * 10000) / 10000;
}

export function serializeMasala(d: any): Masala {
  return {
    id: String(d._id),
    name: d.name,
    rows: (d.rows ?? []).map((r: any) => ({
      name: r.name ?? "",
      qty: r.qty ?? 0,
      unit: r.unit ?? "kg",
      rate: r.rate ?? 0,
    })),
    yieldQty: d.yieldQty ?? 0,
    yieldUnit: d.yieldUnit === "L" ? "L" : "kg",
  };
}

/** Clean a masala body sent from the page. */
export function cleanMasalaBody(body: any) {
  return {
    name: typeof body?.name === "string" ? body.name.trim() : "",
    rows: (Array.isArray(body?.rows) ? body.rows : [])
      .filter((r: any) => (r?.name ?? "").trim())
      .map((r: any) => ({
        name: String(r.name).trim(),
        qty: Math.max(0, Number(r.qty) || 0),
        unit: String(r.unit ?? "").trim() || "kg",
        rate: Math.max(0, Number(r.rate) || 0),
      })),
    yieldQty: Math.max(0, Number(body?.yieldQty) || 0),
    yieldUnit: body?.yieldUnit === "L" ? "L" : "kg",
  };
}
