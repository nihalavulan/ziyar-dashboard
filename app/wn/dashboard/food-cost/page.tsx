"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { todayStr, shiftDate, prettyDate, fmt } from "@/app/dashboard/stock/shared";

const SECTIONS = [
  { key: "mandhi-rice", label: "Mandhi Rice" },
  { key: "madhooth", label: "Madhooth" },
  { key: "alfahm", label: "Alfahm" },
];

const UNITS = ["kg", "g", "L", "ml", "pcs", "dozen", "packet"];
const CUSTOM = "__custom__";

interface Row {
  name: string;
  qty: string;
  unit: string;
  custom: boolean; // unit typed by hand instead of picked from UNITS
  rate: string;
}

type Sheet = Record<string, Row[]>;

const emptyRow = (): Row => ({ name: "", qty: "", unit: "kg", custom: false, rate: "" });
const n = (v: string) => Math.max(0, Number(v) || 0);
const rowTotal = (r: Row) => n(r.qty) * n(r.rate);

function fromApi(sections: Record<string, any[]>): Sheet {
  const sheet: Sheet = {};
  SECTIONS.forEach(({ key }) => {
    sheet[key] = (sections[key] ?? []).map((r) => ({
      name: r.name ?? "",
      qty: r.qty ? String(r.qty) : "",
      unit: r.unit || "kg",
      custom: !UNITS.includes(r.unit || "kg"),
      rate: r.rate ? String(r.rate) : "",
    }));
  });
  return sheet;
}

function toApi(sheet: Sheet) {
  const out: Record<string, unknown[]> = {};
  SECTIONS.forEach(({ key }) => {
    out[key] = (sheet[key] ?? []).map((r) => ({
      name: r.name,
      qty: n(r.qty),
      unit: r.unit,
      rate: n(r.rate),
    }));
  });
  return out;
}

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-white outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

export default function WnFoodCostPage() {
  const [date, setDate] = useState(todayStr());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [active, setActive] = useState(SECTIONS[0].key);
  const [sheet, setSheet] = useState<Sheet>(fromApi({}));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/wn/food-cost?date=${d}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load.");
      setSheet(fromApi(data.sections ?? {}));
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

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/wn/food-cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, sections: toApi(sheet) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setDirty(false);
      setMessage("Saved.");
      // Drop blank rows the server ignored, so the screen matches what's stored.
      setSheet((s) => {
        const next: Sheet = {};
        SECTIONS.forEach(({ key }) => (next[key] = (s[key] ?? []).filter((r) => r.name.trim())));
        return next;
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function copyPrevious() {
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
      const prev = fromApi(data.sections ?? {});
      const hasRows = (sheet[active] ?? []).some((r) => r.name.trim());
      if (hasRows && !confirm(`Replace ${label(active)} with the list from ${data.date}?`)) return;
      update(active, () => prev[active] ?? []);
      setMessage(`Copied ${label(active)} from ${data.date}. Check the quantities, then save.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const sectionTotals = useMemo(() => {
    const t: Record<string, number> = {};
    SECTIONS.forEach(({ key }) => {
      t[key] = (sheet[key] ?? []).reduce((sum, r) => sum + rowTotal(r), 0);
    });
    return t;
  }, [sheet]);
  const dayTotal = Object.values(sectionTotals).reduce((a, b) => a + b, 0);

  const rows = sheet[active] ?? [];
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            className={`rounded-2xl border p-4 text-left transition ${
              active === s.key
                ? "border-brand-500 bg-brand-600/15"
                : "border-white/10 bg-slate-900 hover:bg-slate-800"
            }`}
          >
            <p className="text-xs font-medium text-slate-400">{s.label}</p>
            <p className="mt-1 text-lg font-semibold text-white">₹{fmt(sectionTotals[s.key])}</p>
          </button>
        ))}
        <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
          <p className="text-xs font-medium text-slate-400">Day total</p>
          <p className="mt-1 text-lg font-semibold text-white">₹{fmt(dayTotal)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">{label(active)} — ingredients</h2>
          <button onClick={copyPrevious} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5">
            Copy from previous day
          </button>
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
                      <input className={inputCls} value={r.name} placeholder="e.g. Basmati rice" onChange={(e) => setField(active, i, { name: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <input className={inputCls} type="number" min="0" step="any" inputMode="decimal" value={r.qty} onChange={(e) => setField(active, i, { qty: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      {r.custom ? (
                        <div className="flex gap-1">
                          <input className={inputCls} value={r.unit} placeholder="unit" autoFocus onChange={(e) => setField(active, i, { unit: e.target.value })} />
                          <button onClick={() => setField(active, i, { custom: false, unit: "kg" })} className="rounded-lg px-2 text-slate-500 hover:bg-white/5 hover:text-slate-300" aria-label="Pick a standard unit">↺</button>
                        </div>
                      ) : (
                        <select
                          className={inputCls}
                          value={r.unit}
                          onChange={(e) =>
                            e.target.value === CUSTOM
                              ? setField(active, i, { custom: true, unit: "" })
                              : setField(active, i, { unit: e.target.value })
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
                      <input className={inputCls} type="number" min="0" step="any" inputMode="decimal" value={r.rate} onChange={(e) => setField(active, i, { rate: e.target.value })} />
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-white">{fmt(rowTotal(r))}</td>
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => update(active, (rs) => rs.filter((_, idx) => idx !== i))} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400" aria-label="Remove ingredient">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t border-white/10">
                    <td colSpan={4} className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                      {label(active)} total
                    </td>
                    <td className="px-2 py-3 text-right font-semibold text-white">₹{fmt(sectionTotals[active])}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
          <button onClick={() => update(active, (rs) => [...rs, emptyRow()])} className="rounded-lg border border-dashed border-white/20 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">
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
    </div>
  );
}

function label(key: string) {
  return SECTIONS.find((s) => s.key === key)?.label ?? key;
}
