"use client";

import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";

interface Task {
  time: string;
  text: string;
}

interface Member {
  id: string;
  name: string;
  role: string;
  tasks: Task[];
  responsibilities: string[];
  kpis: string[];
  notes: string;
}

type Draft = Omit<Member, "id"> & { id: string | null };

const blankDraft = (): Draft => ({
  id: null,
  name: "",
  role: "",
  tasks: [{ time: "", text: "" }],
  responsibilities: [""],
  kpis: [""],
  notes: "",
});

const toDraft = (m: Member): Draft => ({
  ...m,
  tasks: m.tasks.length ? m.tasks.map((t) => ({ ...t })) : [{ time: "", text: "" }],
  responsibilities: m.responsibilities.length ? [...m.responsibilities] : [""],
  kpis: m.kpis.length ? [...m.kpis] : [""],
});

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";
const iconBtn =
  "rounded-lg px-2 py-1 text-slate-500 hover:bg-white/5 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent";

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export default function WnSopPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wn/sop");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load.");
      setMembers(data.members);
      return data.members as Member[];
    } catch (e) {
      setError((e as Error).message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().then((list) => {
      if (list.length) setDraft(toDraft(list[0]));
    });
  }, [load]);

  function confirmLeave() {
    return !dirty || confirm("You have unsaved changes. Discard them?");
  }

  function open(m: Member | null) {
    if (!confirmLeave()) return;
    setDraft(m ? toDraft(m) : blankDraft());
    setDirty(false);
    setError("");
    setMessage("");
  }

  function edit(patch: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
    setMessage("");
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(draft.id ? `/api/wn/sop/${draft.id}` : "/api/wn/sop", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      await load();
      setDraft(toDraft(data.member));
      setDirty(false);
      setMessage("Saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!draft?.id) return;
    if (!confirm(`Delete ${draft.name}'s SOP? This can't be undone.`)) return;
    try {
      const res = await fetch(`/api/wn/sop/${draft.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to delete.");
      const list = await load();
      setDraft(list.length ? toDraft(list[0]) : null);
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">SOP Creator</h1>
          <p className="mt-1 text-sm text-slate-400">
            Daily tasks, responsibilities and KPIs for each team member.
          </p>
        </div>
        {members.length > 0 && (
          <button
            onClick={() => exportPdf(members, "team-sop.pdf")}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Download all (PDF)
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        {/* Member list */}
        <aside className="space-y-2">
          <button
            onClick={() => open(null)}
            className="w-full rounded-xl border border-dashed border-white/20 px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5"
          >
            + Add member
          </button>
          {loading && members.length === 0 && (
            <p className="px-1 py-3 text-sm text-slate-500">Loading…</p>
          )}
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => open(m)}
              className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                draft?.id === m.id
                  ? "border-brand-500 bg-brand-600/15"
                  : "border-white/10 bg-slate-900 hover:bg-slate-800"
              }`}
            >
              <p className="text-sm font-medium text-white">{m.name}</p>
              <p className="text-xs text-slate-400">
                {m.role || "No role"} · {m.tasks.length} task{m.tasks.length === 1 ? "" : "s"}
              </p>
            </button>
          ))}
        </aside>

        {/* Editor */}
        {!draft ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
            {loading ? "" : "No members yet. Click “+ Add member” to write the first SOP."}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-slate-900">
            <div className="grid gap-4 border-b border-white/10 p-4 sm:grid-cols-2">
              <Field label="Name">
                <input className={inputCls} value={draft.name} placeholder="e.g. Rafeeq" onChange={(e) => edit({ name: e.target.value })} />
              </Field>
              <Field label="Role">
                <input className={inputCls} value={draft.role} placeholder="e.g. Head Chef" onChange={(e) => edit({ role: e.target.value })} />
              </Field>
            </div>

            <Section title="Daily tasks (SOP)" hint="In the order they should be done. Time is optional.">
              <div className="space-y-2">
                {draft.tasks.map((t, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-2 w-5 shrink-0 text-right text-xs text-slate-500">{i + 1}.</span>
                    <input
                      className={`${inputCls} !w-28 shrink-0`}
                      value={t.time}
                      placeholder="Time"
                      onChange={(e) => edit({ tasks: draft.tasks.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)) })}
                    />
                    <input
                      className={`${inputCls} min-w-0 flex-1`}
                      data-line={`tasks-${i}`}
                      value={t.text}
                      placeholder="What needs to be done"
                      onChange={(e) => edit({ tasks: draft.tasks.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const next = [...draft.tasks];
                          next.splice(i + 1, 0, { time: "", text: "" });
                          flushSync(() => edit({ tasks: next }));
                          focusLine(`tasks-${i + 1}`);
                        }
                      }}
                    />
                    <RowControls
                      index={i}
                      length={draft.tasks.length}
                      onMove={(dir) => edit({ tasks: move(draft.tasks, i, dir) })}
                      onRemove={() => edit({ tasks: draft.tasks.filter((_, j) => j !== i) })}
                    />
                  </div>
                ))}
              </div>
              <AddLine onClick={() => edit({ tasks: [...draft.tasks, { time: "", text: "" }] })}>+ Add task</AddLine>
            </Section>

            <Section title="Responsibilities" hint="What this person owns overall.">
              <LineList
                items={draft.responsibilities}
                placeholder="e.g. Kitchen hygiene and stock rotation"
                onChange={(responsibilities) => edit({ responsibilities })}
                addLabel="+ Add responsibility"
              />
            </Section>

            <Section title="KPIs" hint="How you'll judge if they're doing well.">
              <LineList
                items={draft.kpis}
                placeholder="e.g. Food waste under 2 kg per day"
                onChange={(kpis) => edit({ kpis })}
                addLabel="+ Add KPI"
              />
            </Section>

            <Section title="Notes">
              <textarea
                className={`${inputCls} min-h-[80px]`}
                value={draft.notes}
                placeholder="Anything else (optional)"
                onChange={(e) => edit({ notes: e.target.value })}
              />
            </Section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
              <div className="flex gap-2">
                {draft.id && (
                  <button onClick={remove} className="rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10">
                    Delete
                  </button>
                )}
                {draft.id && !dirty && (
                  <button
                    onClick={() => exportPdf([draft as Member], `sop-${slug(draft.name)}.pdf`)}
                    className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
                  >
                    Download PDF
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {error && <span className="text-sm text-red-400">{error}</span>}
                {!error && message && <span className="text-sm text-emerald-400">{message}</span>}
                {!error && !message && dirty && <span className="text-sm text-amber-400">Unsaved changes</span>}
                {!draft.id && (
                  <button
                    onClick={() => {
                      const first = members[0];
                      setDraft(first ? toDraft(first) : null);
                      setDirty(false);
                      setError("");
                    }}
                    className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={save}
                  disabled={saving || !dirty}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : draft.id ? "Save" : "Create SOP"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/10 p-4">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-xs text-slate-500">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </div>
  );
}

function AddLine({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="mt-2 rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200">
      {children}
    </button>
  );
}

function RowControls({
  index,
  length,
  onMove,
  onRemove,
}: {
  index: number;
  length: number;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center pt-1">
      <button className={iconBtn} disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">↑</button>
      <button className={iconBtn} disabled={index === length - 1} onClick={() => onMove(1)} aria-label="Move down">↓</button>
      <button className={`${iconBtn} hover:!bg-red-500/10 hover:!text-red-400`} onClick={onRemove} aria-label="Remove">✕</button>
    </div>
  );
}

function LineList({
  items,
  placeholder,
  onChange,
  addLabel,
}: {
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
  addLabel: string;
}) {
  return (
    <>
      <div className="space-y-2">
        {items.map((value, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-2 w-5 shrink-0 text-right text-xs text-slate-500">•</span>
            <input
              className={`${inputCls} min-w-0 flex-1`}
              data-line={`${placeholder}-${i}`}
              value={value}
              placeholder={placeholder}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const next = [...items];
                  next.splice(i + 1, 0, "");
                  flushSync(() => onChange(next));
                  focusLine(`${placeholder}-${i + 1}`);
                }
              }}
            />
            <RowControls
              index={i}
              length={items.length}
              onMove={(dir) => onChange(move(items, i, dir))}
              onRemove={() => onChange(items.filter((_, j) => j !== i))}
            />
          </div>
        ))}
      </div>
      <AddLine onClick={() => onChange([...items, ""])}>{addLabel}</AddLine>
    </>
  );
}

/** Move the cursor to a freshly inserted line (call after a flushSync render). */
function focusLine(key: string) {
  document.querySelector<HTMLInputElement>(`[data-line="${CSS.escape(key)}"]`)?.focus();
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "member";
}

/** One page per member: name/role header, then tasks, responsibilities, KPIs, notes. */
async function exportPdf(list: Member[], filename: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  const head = { fillColor: [0, 36, 34] as [number, number, number] };
  const styles = { fontSize: 10, cellPadding: 3 };

  list.forEach((m, idx) => {
    if (idx > 0) doc.addPage();
    doc.setTextColor(20);
    doc.setFontSize(18);
    doc.text(m.name, 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(110);
    doc.text(m.role || "", 14, 27);

    let y = 34;
    const tasks = m.tasks.filter((t) => t.text.trim());
    if (tasks.length) {
      autoTable(doc, {
        startY: y,
        head: [["#", "Time", "Daily task"]],
        body: tasks.map((t, i) => [String(i + 1), t.time, t.text]),
        headStyles: head,
        styles,
        columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 32 } },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    const lists: [string, string[]][] = [
      ["Responsibilities", m.responsibilities],
      ["KPIs", m.kpis],
    ];
    lists.forEach(([title, items]) => {
      const clean = items.filter((s) => s.trim());
      if (!clean.length) return;
      autoTable(doc, {
        startY: y,
        head: [[title]],
        body: clean.map((s) => [`-  ${s}`]),
        headStyles: head,
        styles,
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    });

    if (m.notes.trim()) {
      autoTable(doc, {
        startY: y,
        head: [["Notes"]],
        body: [[m.notes]],
        headStyles: head,
        styles,
      });
    }
  });

  doc.save(filename);
}
