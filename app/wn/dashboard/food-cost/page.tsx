"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { todayStr, shiftDate, prettyDate, fmt } from "@/app/dashboard/stock/shared";

const UNITS = ["kg", "g", "L", "ml", "pcs", "dozen", "packet"];
const CUSTOM = "__custom__";

interface Item {
  id: string;
  name: string;
}

interface Row {
  name: string;
  qty: string;
  unit: string;
  custom: boolean; // unit typed by hand instead of picked from UNITS
  rate: string;
}

/** A dish shown on the page: one from the list, or one only found in this day's saved sheet. */
interface Section {
  key: string;
  label: string;
  removed: boolean; // no longer in the dish list, but this day has rows for it
}

type Sheet = Record<string, Row[]>;

const emptyRow = (): Row => ({ name: "", qty: "", unit: "kg", custom: false, rate: "" });
const n = (v: string) => Math.max(0, Number(v) || 0);
const rowTotal = (r: Row) => n(r.qty) * n(r.rate);

function rowsFromApi(rows: any[]): Row[] {
  return (rows ?? []).map((r) => ({
    name: r.name ?? "",
    qty: r.qty ? String(r.qty) : "",
    unit: r.unit || "kg",
    custom: !UNITS.includes(r.unit || "kg"),
    rate: r.rate ? String(r.rate) : "",
  }));
}

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-white outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

export default function WnFoodCostPage() {
  const [date, setDate] = useState(todayStr());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>({});
  const [savedLabels, setSavedLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const sections: Section[] = useMemo(() => {
    const listed = items.map((it) => ({ key: it.id, label: it.name, removed: false }));
    const known = new Set(items.map((it) => it.id));
    const extra = Object.keys(sheet)
      .filter((k) => !known.has(k) && (sheet[k] ?? []).length > 0)
      .map((k) => ({ key: k, label: savedLabels[k] || "Removed item", removed: true }));
    return [...listed, ...extra];
  }, [items, sheet, savedLabels]);

  const label = (key: string | null) => sections.find((s) => s.key === key)?.label ?? "";

  // Keep a valid dish selected as the list changes.
  useEffect(() => {
    if (!sections.length) setActive(null);
    else if (!active || !sections.some((s) => s.key === active)) setActive(sections[0].key);
  }, [sections, active]);

  useEffect(() => {
    fetch("/api/wn/food-items")
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => setError("Failed to load items."));
  }, []);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/wn/food-cost?date=${d}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load.");
      const next: Sheet = {};
      const labels: Record<string, string> = {};
      (data.sections ?? []).forEach((s: any) => {
        next[s.key] = rowsFromApi(s.rows);
        labels[s.key] = s.label ?? "";
      });
      setSheet(next);
      setSavedLabels(labels);
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  function changeDate(next: string) {
    if (dirty && !confirm("You have unsaved changes. Leave this day without saving?")) return;
    setDate(next);
  }

  function update(key: string, fn: (rows: Row[]) => Row[]) {
    setSheet((s) => ({ ...s, [key]: fn(s[key] ?? []) }));
    setDirty(true);
    setMessage("");
  }

  function setField(key: string, i: number, patch: Partial<Row>) {
    update(key, (rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function addItem() {
    const name = newName.trim();
    if (!name) return;
    setError("");
    try {
      const res = await fetch("/api/wn/food-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add item.");
      setItems((list) => [...list, data.item]);
      setActive(data.item.id);
      setNewName("");
      setAdding(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function renameItem() {
    const name = renameValue.trim();
    if (!active || !name) return;
    setError("");
    try {
      const res = await fetch(`/api/wn/food-items/${active}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to rename.");
      setItems((list) => list.map((it) => (it.id === active ? data.item : it)));
      setRenaming(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteItem() {
    if (!active) return;
    if (
      !confirm(
        `Remove ${label(active)} from the list? Days already saved with it keep their figures.`
      )
    )
      return;
    setError("");
    try {
      const res = await fetch(`/api/wn/food-items/${active}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to remove.");
      // Unsaved rows for it on this day go too; saved ones still show as "removed".
      const id = active;
      setItems((list) => list.filter((it) => it.id !== id));
      if (!savedLabels[id]) {
        setSheet((s) => {
          const next = { ...s };
          delete next[id];
          return next;
        });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = sections.map((s) => ({
        key: s.key,
        label: s.label,
        rows: (sheet[s.key] ?? []).map((r) => ({
          name: r.name,
          qty: n(r.qty),
          unit: r.unit,
          rate: n(r.rate),
        })),
      }));
      const res = await fetch("/api/wn/food-cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, sections: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setDirty(false);
      setMessage("Saved.");
      // Match what's stored: blank rows dropped, labels remembered for this day.
      const labels: Record<string, string> = {};
      const next: Sheet = {};
      sections.forEach((s) => {
        const kept = (sheet[s.key] ?? []).filter((r) => r.name.trim());
        if (kept.length) labels[s.key] = s.label;
        next[s.key] = kept;
      });
      setSheet(next);
      setSavedLabels(labels);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function copyPrevious() {
    if (!active) return;
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/wn/food-cost?prevOf=${date}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load.");
      if (!data.date) {
        setError("No earlier day has been saved yet.");
        return;
      }
      const prev = (data.sections ?? []).find((s: any) => s.key === active);
      if (!prev || !prev.rows?.length) {
        setError(`${label(active)} has no ingredients on ${data.date}.`);
        return;
      }
      const hasRows = (sheet[active] ?? []).some((r) => r.name.trim());
      if (hasRows && !confirm(`Replace ${label(active)} with the list from ${data.date}?`)) return;
      update(active, () => rowsFromApi(prev.rows));
      setMessage(`Copied ${label(active)} from ${data.date}. Check the quantities, then save.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const sectionTotals = useMemo(() => {
    const t: Record<string, number> = {};
    sections.forEach(({ key }) => {
      t[key] = (sheet[key] ?? []).reduce((sum, r) => sum + rowTotal(r), 0);
    });
    return t;
  }, [sheet, sections]);
  const dayTotal = Object.values(sectionTotals).reduce((a, b) => a + b, 0);

  const activeSection = sections.find((s) => s.key === active) ?? null;
  const rows = active ? sheet[active] ?? [] : [];
  const isToday = mounted && date === todayStr();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Food Cost</h1>
          <p className="mt-1 text-sm text-slate-400">{mounted ? prettyDate(date) : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(shiftDate(date, -1))} className="rounded-lg border border-white/10 px-3 py-2 text-slate-300 hover:bg-white/5" aria-label="Previous day">‹</button>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && changeDate(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white [color-scheme:dark]"
          />
          <button onClick={() => changeDate(shiftDate(date, 1))} className="rounded-lg border border-white/10 px-3 py-2 text-slate-300 hover:bg-white/5" aria-label="Next day">›</button>
          {mounted && !isToday && (
            <button onClick={() => changeDate(todayStr())} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/15">Today</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => {
              setActive(s.key);
              setRenaming(false);
            }}
            className={`rounded-2xl border p-4 text-left transition ${
              active === s.key
                ? "border-brand-500 bg-brand-600/15"
                : "border-white/10 bg-slate-900 hover:bg-slate-800"
            }`}
          >
            <p className="truncate text-xs font-medium text-slate-400">
              {s.label}
              {s.removed && <span className="text-slate-600"> (removed)</span>}
            </p>
            <p className="mt-1 text-lg font-semibold text-white">₹{fmt(sectionTotals[s.key] ?? 0)}</p>
          </button>
        ))}

        {adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addItem();
            }}
            className="flex flex-col gap-2 rounded-2xl border border-brand-500 bg-slate-900 p-3"
          >
            <input
              className={inputCls}
              value={newName}
              autoFocus
              placeholder="Item name, e.g. Mandhi Rice"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            />
            <div className="flex gap-2">
              <button type="submit" disabled={!newName.trim()} className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">Add</button>
              <button type="button" onClick={() => setAdding(false)} className="rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-white/5">Cancel</button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex min-h-[76px] items-center justify-center rounded-2xl border border-dashed border-white/20 p-4 text-sm text-slate-300 hover:bg-white/5"
          >
            + Add item
          </button>
        )}

        {sections.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
            <p className="text-xs font-medium text-slate-400">Day total</p>
            <p className="mt-1 text-lg font-semibold text-white">₹{fmt(dayTotal)}</p>
          </div>
        )}
      </div>

      {!activeSection ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
          No items yet. Click “+ Add item” to add your first dish (e.g. Mandhi Rice).
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            {renaming ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  renameItem();
                }}
                className="flex flex-1 items-center gap-2"
              >
                <input
                  className={`${inputCls} max-w-xs`}
                  value={renameValue}
                  autoFocus
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setRenaming(false)}
                />
                <button type="submit" disabled={!renameValue.trim()} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">Save name</button>
                <button type="button" onClick={() => setRenaming(false)} className="rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-white/5">Cancel</button>
              </form>
            ) : (
              <h2 className="text-sm font-semibold text-white">
                {activeSection.label} — ingredients
                {activeSection.removed && (
                  <span className="ml-2 font-normal text-slate-500">(removed from list, kept on this day)</span>
                )}
              </h2>
            )}
            <div className="flex items-center gap-1">
              {!activeSection.removed && !renaming && (
                <>
                  <button
                    onClick={() => {
                      setRenameValue(activeSection.label);
                      setRenaming(true);
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5"
                  >
                    Rename
                  </button>
                  <button onClick={deleteItem} className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10">
                    Remove item
                  </button>
                </>
              )}
              <button onClick={copyPrevious} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5">
                Copy from previous day
              </button>
            </div>
          </div>

          {loading ? (
            <p className="p-6 text-center text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2 font-medium">Ingredient</th>
                    <th className="w-24 px-2 py-2 font-medium">Qty</th>
                    <th className="w-36 px-2 py-2 font-medium">Unit</th>
                    <th className="w-28 px-2 py-2 font-medium">Rate / unit (₹)</th>
                    <th className="w-28 px-2 py-2 text-right font-medium">Total (₹)</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No ingredients for this day yet.
                      </td>
                    </tr>
                  )}
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="px-4 py-2">
                        <input className={inputCls} value={r.name} placeholder="e.g. Basmati rice" onChange={(e) => setField(activeSection.key, i, { name: e.target.value })} />
                      </td>
                      <td className="px-2 py-2">
                        <input className={inputCls} type="number" min="0" step="any" inputMode="decimal" value={r.qty} onChange={(e) => setField(activeSection.key, i, { qty: e.target.value })} />
                      </td>
                      <td className="px-2 py-2">
                        {r.custom ? (
                          <div className="flex gap-1">
                            <input className={inputCls} value={r.unit} placeholder="unit" autoFocus onChange={(e) => setField(activeSection.key, i, { unit: e.target.value })} />
                            <button onClick={() => setField(activeSection.key, i, { custom: false, unit: "kg" })} className="rounded-lg px-2 text-slate-500 hover:bg-white/5 hover:text-slate-300" aria-label="Pick a standard unit">↺</button>
                          </div>
                        ) : (
                          <select
                            className={inputCls}
                            value={r.unit}
                            onChange={(e) =>
                              e.target.value === CUSTOM
                                ? setField(activeSection.key, i, { custom: true, unit: "" })
                                : setField(activeSection.key, i, { unit: e.target.value })
                            }
                          >
                            {UNITS.map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                            <option value={CUSTOM}>Custom…</option>
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input className={inputCls} type="number" min="0" step="any" inputMode="decimal" value={r.rate} onChange={(e) => setField(activeSection.key, i, { rate: e.target.value })} />
                      </td>
                      <td className="px-2 py-2 text-right font-medium text-white">{fmt(rowTotal(r))}</td>
                      <td className="px-2 py-2 text-right">
                        <button onClick={() => update(activeSection.key, (rs) => rs.filter((_, idx) => idx !== i))} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400" aria-label="Remove ingredient">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {rows.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-white/10">
                      <td colSpan={4} className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                        {activeSection.label} total
                      </td>
                      <td className="px-2 py-3 text-right font-semibold text-white">₹{fmt(sectionTotals[activeSection.key] ?? 0)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
            <button onClick={() => update(activeSection.key, (rs) => [...rs, emptyRow()])} className="rounded-lg border border-dashed border-white/20 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">
              + Add ingredient
            </button>
            <div className="flex items-center gap-3">
              {error && <span className="text-sm text-red-400">{error}</span>}
              {!error && message && <span className="text-sm text-emerald-400">{message}</span>}
              {!error && !message && dirty && <span className="text-sm text-amber-400">Unsaved changes</span>}
              <button onClick={save} disabled={saving || !dirty} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save day"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!activeSection && error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
