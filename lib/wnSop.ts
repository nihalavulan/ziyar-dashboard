/** Shared shape + cleaning for SOP payloads (used by the /api/wn/sop routes). */
export interface SopInput {
  name: string;
  role: string;
  tasks: { time: string; text: string }[];
  responsibilities: string[];
  kpis: string[];
  notes: string;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown) =>
  (Array.isArray(v) ? v : []).map(str).filter(Boolean);

/** Trim everything and drop empty lines. */
export function cleanSop(body: any): SopInput {
  return {
    name: str(body?.name),
    role: str(body?.role),
    tasks: (Array.isArray(body?.tasks) ? body.tasks : [])
      .map((t: any) => ({ time: str(t?.time), text: str(t?.text) }))
      .filter((t: { text: string }) => t.text),
    responsibilities: list(body?.responsibilities),
    kpis: list(body?.kpis),
    notes: typeof body?.notes === "string" ? body.notes.trim() : "",
  };
}

export function serializeSop(doc: any) {
  return {
    id: String(doc._id),
    name: doc.name ?? "",
    role: doc.role ?? "",
    tasks: (doc.tasks ?? []).map((t: any) => ({ time: t.time ?? "", text: t.text ?? "" })),
    responsibilities: doc.responsibilities ?? [],
    kpis: doc.kpis ?? [],
    notes: doc.notes ?? "",
    updatedAt: doc.updatedAt ?? null,
  };
}
