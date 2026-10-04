"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface FoodRow {
  foodItemId: string;
  name: string;
  prepared: number;
  sold: number;
  damage: number;
  rate: number;
}

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function shiftDate(s: string, days: number) {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}
function prettyDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
const num = (v: string) => Math.max(0, Number(v) || 0);

export default function PnlPage() {
  const [date, setDate] = useState(todayStr());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [rows, setRows] = useState<FoodRow[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [staffFood, setStaffFood] = useState(0);
  const [fixedDaily, setFixedDaily] = useState(0);
  const [salaryPaid, setSalaryPaid] = useState(0);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [nName, setNName] = useState("");
  const [nRate, setNRate] = useState("");

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/pnl?date=${d}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load.");
      setRows(
        data.foodRows.map((r: any) => ({
          foodItemId: r.foodItemId,
          name: r.name,
          prepared: r.prepared,
          sold: r.sold,
          damage: r.damage,
          rate: r.rate,
        }))
      );
      setTotalSales(data.totalSales);
      setStaffFood(data.staffFood);
      setFixedDaily(data.fixedDaily);
      setSalaryPaid(data.salaryPaid);
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

  function setRow(id: string, patch: Partial<FoodRow>) {
    setRows((prev) => prev.map((r) => (r.foodItemId === id ? { ...r, ...patch } : r)));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/pnl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, foodRows: rows, totalSales, staffFood }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setDirty(false);
      await load(date);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!nName.trim()) return;
    try {
      const res = await fetch("/api/food-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nName.trim(), rate: num(nRate) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add item.");
      setNName("");
      setNRate("");
      setShowAdd(false);
      await load(date);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function removeItem(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This removes the item and all its daily figures.`)) return;
    try {
      const res = await fetch(`/api/food-items/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete.");
      await load(date);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const foodCost = useMemo(() => rows.reduce((a, r) => a + r.sold * r.rate, 0), [rows]);
  const basicExpenses = staffFood + fixedDaily + salaryPaid;
  const profit = totalSales - foodCost - basicExpenses;

  const isToday = date === todayStr();

  const SaveBtn = (
    <button onClick={save} disabled={saving || !dirty}
      className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
      {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
    </button>
  );

  return (
    <div className="space-y-5">
      {dirty && (
        <div className="sticky top-16 z-20 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 shadow-sm">
          <span><strong className="font-semibold">You have unsaved changes.</strong> Don&apos;t forget to save.</span>
          {SaveBtn}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setDate((d) => shiftDate(d, -1))} className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50" aria-label="Previous day">‹</button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
          <button onClick={() => setDate((d) => shiftDate(d, 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50" aria-label="Next day">›</button>
          {!isToday && <button onClick={() => setDate(todayStr())} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200">Today</button>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdd((s) => !s)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">+ Item</button>
          {SaveBtn}
        </div>
      </div>

      <p className="px-1 text-sm text-slate-500">{mounted ? prettyDate(date) : " "}</p>

      {showAdd && (
        <form onSubmit={addItem} className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50/50 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Item</label>
            <input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="e.g. Fish fry" autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
          </div>
          <div className="w-full sm:w-36">
            <label className="mb-1 block text-xs font-medium text-slate-600">Default rate</label>
            <input type="number" inputMode="decimal" min={0} value={nRate} onChange={(e) => setNRate(e.target.value)} placeholder="0"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Add</button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-white">Cancel</button>
          </div>
        </form>
      )}

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {/* Food table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 text-right font-medium">Prepared</th>
              <th className="px-4 py-3 text-right font-medium">Sold</th>
              <th className="px-4 py-3 text-right font-medium">Balance</th>
              <th className="px-4 py-3 text-right font-medium">Damage</th>
              <th className="px-4 py-3 text-right font-medium">Rate</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-2 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No items yet. Click <strong>+ Item</strong> to add one.</td></tr>
            ) : (
              rows.map((r) => {
                const balance = r.prepared - r.sold - r.damage;
                const total = r.sold * r.rate;
                const numInput = (f: "prepared" | "sold" | "damage" | "rate") => (
                  <input type="number" inputMode="decimal" min={0} value={r[f] === 0 ? "" : r[f]}
                    onChange={(e) => setRow(r.foodItemId, { [f]: num(e.target.value) } as any)} placeholder="0"
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-right tabular-nums outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
                );
                return (
                  <tr key={r.foodItemId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-2">
                      <input value={r.name} onChange={(e) => setRow(r.foodItemId, { name: e.target.value })} title="Click to edit"
                        className="w-32 rounded-lg border border-transparent px-2 py-1.5 font-medium text-slate-800 outline-none hover:border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
                    </td>
                    <td className="px-4 py-2 text-right">{numInput("prepared")}</td>
                    <td className="px-4 py-2 text-right">{numInput("sold")}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">{fmt(balance)}</td>
                    <td className="px-4 py-2 text-right">{numInput("damage")}</td>
                    <td className="px-4 py-2 text-right">{numInput("rate")}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-900">{fmt(total)}</td>
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => removeItem(r.foodItemId, r.name)} className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500" title="Delete item">✕</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                <td className="px-4 py-3" colSpan={6}>Total food cost</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(foodCost)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Daily inputs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="mb-1 block text-xs font-medium text-slate-600">Total sales (today&apos;s revenue)</label>
          <input type="number" inputMode="decimal" min={0} value={totalSales === 0 ? "" : totalSales}
            onChange={(e) => { setTotalSales(num(e.target.value)); setDirty(true); }} placeholder="0"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg font-semibold tabular-nums outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="mb-1 block text-xs font-medium text-slate-600">Staff food expense (today)</label>
          <input type="number" inputMode="decimal" min={0} value={staffFood === 0 ? "" : staffFood}
            onChange={(e) => { setStaffFood(num(e.target.value)); setDirty(true); }} placeholder="0"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg font-semibold tabular-nums outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
        </div>
      </div>

      {/* P&L box */}
      <div className="rounded-2xl border-2 border-brand-600 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-900">Total Profit &amp; Loss</h3>
        <div className="space-y-2.5 text-sm">
          <Line label="Total sales" value={totalSales} />
          <Line label="Food cost" value={-foodCost} />
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <Line label="Basic expenses" value={-basicExpenses} bold />
            <div className="mt-1.5 space-y-1 pl-3 text-xs text-slate-500">
              <SubLine label="Staff food" value={staffFood} />
              <SubLine label="Fixed expenses (per day)" value={fixedDaily} />
              <SubLine label="Salary paid today" value={salaryPaid} />
            </div>
          </div>
        </div>
        <div className={`mt-4 flex items-center justify-between rounded-xl px-4 py-3 ${profit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
          <span className="text-sm font-medium text-slate-700">
            {profit >= 0 ? "Profit" : "Loss"} — Total balance
          </span>
          <span className={`text-2xl font-bold tabular-nums ${profit >= 0 ? "text-green-700" : "text-red-600"}`}>
            {fmt(profit)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-1">
        {dirty && <span className="text-sm text-amber-600">Unsaved changes</span>}
        {SaveBtn}
      </div>

      <p className="px-1 text-xs text-slate-400">
        Balance = Prepared − Sold − Damage. Total = Sold × Rate (food cost). Fixed
        expenses and salary are pulled automatically from those sections. Profit =
        Sales − Food cost − Basic expenses.
      </p>
    </div>
  );
}

function Line({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-medium text-slate-700" : "text-slate-600"}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold" : ""} ${value < 0 ? "text-slate-700" : "text-slate-900"}`}>
        {value < 0 ? `(${fmt(-value)})` : fmt(value)}
      </span>
    </div>
  );
}
function SubLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="tabular-nums">{fmt(value)}</span>
    </div>
  );
}
