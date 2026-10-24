"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SectionTabs from "@/components/SectionTabs";
import { STOCK_TABS, todayStr, shiftDate, fmt, groupRows } from "../shared";

interface Row {
  itemId: string;
  name: string;
  category: string;
  unit: string;
  rate: number;
  opening: number;
  received: number;
  used: number;
  usedValue: number;
  closing: number;
  closingValue: number;
}

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 6 },
  { label: "30 days", days: 29 },
];

export default function StockUsagePage() {
  const [to, setTo] = useState(todayStr());
  const [from, setFrom] = useState(shiftDate(todayStr(), -6));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [catFilter, setCatFilter] = useState("");

  const load = useCallback(async (f: string, t: string) => {
    if (!f || !t || f > t) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/stock/usage?from=${f}&to=${t}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load.");
      setRows(data.rows);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(from, to);
  }, [from, to, load]);

  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.category))).sort(), [rows]);
  const visible = useMemo(() => rows.filter((r) => !catFilter || r.category === catFilter), [rows, catFilter]);
  const groups = useMemo(() => groupRows(visible), [visible]);
  const totals = useMemo(
    () =>
      visible.reduce(
        (a, r) => ({ usedValue: a.usedValue + r.usedValue, closingValue: a.closingValue + r.closingValue }),
        { usedValue: 0, closingValue: 0 }
      ),
    [visible]
  );

  // Category breakdown of value used, largest first.
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    visible.forEach((r) => m.set(r.category, (m.get(r.category) ?? 0) + r.usedValue));
    return Array.from(m.entries()).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }, [visible]);
  const maxCat = byCategory.length ? byCategory[0][1] : 0;

  async function exportCsv() {
    const header = ["Category", "Item", "Unit", "Opening", "Received", "Used", "Rate", "Used value", "Closing", "Closing value"];
    const lines = [header, ...visible.map((r) => [r.category, r.name, r.unit, r.opening, r.received, r.used, r.rate, r.usedValue, r.closing, r.closingValue])];
    const csv = lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-usage_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const dateCls = "rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

  return (
    <div className="space-y-5">
      <SectionTabs tabs={STOCK_TABS} />

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className={dateCls} />
          <span className="text-sm text-slate-400">to</span>
          <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className={dateCls} />
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => { setTo(todayStr()); setFrom(shiftDate(todayStr(), -p.days)); }}
              className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200">
              {p.label}
            </button>
          ))}
        </div>
        <button onClick={exportCsv} disabled={visible.length === 0}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          Export CSV
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Stock used (value)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">₹{fmt(totals.usedValue)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Stock in hand at end (value)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">₹{fmt(totals.closingValue)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-1">
          <p className="mb-2 text-xs font-medium text-slate-500">Used by category</p>
          {byCategory.length === 0 ? (
            <p className="text-sm text-slate-400">No usage in this range.</p>
          ) : (
            <div className="space-y-1.5">
              {byCategory.map(([c, v]) => (
                <div key={c} className="flex items-center gap-2 text-xs">
                  <span className="w-24 truncate text-slate-600">{c}</span>
                  <div className="h-2 flex-1 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-brand-600" style={{ width: `${(v / maxCat) * 100}%` }} />
                  </div>
                  <span className="w-20 text-right tabular-nums text-slate-700">₹{fmt(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {categories.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {["", ...categories].map((c) => (
            <button key={c || "all"} onClick={() => setCatFilter(c)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${catFilter === c ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
              {c || "All"}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-3 py-3 text-right font-medium">Opening</th>
              <th className="px-3 py-3 text-right font-medium">Received</th>
              <th className="px-3 py-3 text-right font-medium">Used</th>
              <th className="px-3 py-3 text-right font-medium">Used ₹</th>
              <th className="px-3 py-3 text-right font-medium">Closing</th>
              <th className="px-4 py-3 text-right font-medium">Closing ₹</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No stock items yet.</td></tr>
            ) : (
              groups.map(([cat, list]) => [
                <tr key={`h-${cat}`} className="border-b border-slate-100 bg-slate-50/80">
                  <td colSpan={4} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-brand-700">{cat}</td>
                  <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-slate-600">₹{fmt(list.reduce((a, r) => a + r.usedValue, 0))}</td>
                  <td></td>
                  <td className="px-4 py-2 text-right text-xs font-semibold tabular-nums text-slate-600">₹{fmt(list.reduce((a, r) => a + r.closingValue, 0))}</td>
                </tr>,
                ...list.map((r) => (
                  <tr key={r.itemId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.name} <span className="font-normal text-slate-400">({r.unit})</span></td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{fmt(r.opening)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmt(r.received)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-800">{fmt(r.used)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmt(r.usedValue)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmt(r.closing)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">{fmt(r.closingValue)}</td>
                  </tr>
                )),
              ])
            )}
          </tbody>
          {visible.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                <td className="px-4 py-3" colSpan={4}>Total</td>
                <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.usedValue)}</td>
                <td></td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.closingValue)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="px-1 text-xs text-slate-400">
        Used is worked out from physical counts: stock before the count + received −
        count. Days an item wasn&apos;t counted carry their stock forward, so the usage
        shows up on the next counted day.
      </p>
    </div>
  );
}
