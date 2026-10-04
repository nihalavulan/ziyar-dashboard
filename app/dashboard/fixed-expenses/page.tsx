"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Period = "day" | "month" | "year";
interface Row {
  id: string;
  name: string;
  amount: number;
  period: Period;
}

// 30-day average month, 360-day year (30 × 12).
const DIVISOR: Record<Period, number> = { day: 1, month: 30, year: 360 };
function perDay(r: { amount: number; period: Period }) {
  return r.amount / DIVISOR[r.period];
}
function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function FixedExpensesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [nName, setNName] = useState("");
  const [nAmount, setNAmount] = useState("");
  const [nPeriod, setNPeriod] = useState<Period>("month");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/fixed-expenses");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load.");
      setRows(data.expenses.map((e: any) => ({ id: String(e._id), name: e.name, amount: e.amount, period: e.period })));
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/fixed-expenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenses: rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setDirty(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!nName.trim()) return;
    try {
      const res = await fetch("/api/fixed-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nName.trim(), amount: Math.max(0, Number(nAmount) || 0), period: nPeriod }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add.");
      setNName("");
      setNAmount("");
      setNPeriod("month");
      setShowAdd(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function removeExpense(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const res = await fetch(`/api/fixed-expenses/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const totals = useMemo(() => {
    const day = rows.reduce((a, r) => a + perDay(r), 0);
    return { day, month: day * 30, year: day * 360 };
  }, [rows]);

  const SaveBtn = (
    <button
      onClick={save}
      disabled={saving || !dirty}
      className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Fixed Expenses</h2>
          <p className="mt-1 text-sm text-slate-500">
            Recurring costs, broken down to a per-day figure (30-day month).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd((s) => !s)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + Expense
          </button>
          {SaveBtn}
        </div>
      </div>

      {dirty && (
        <div className="sticky top-16 z-20 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 shadow-sm">
          <span><strong className="font-semibold">You have unsaved changes.</strong> Don&apos;t forget to save.</span>
          {SaveBtn}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-brand-600 bg-brand-50/40 p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Per day</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{fmt(totals.day)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Per month (×30)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{fmt(totals.month)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Per year (×360)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{fmt(totals.year)}</p>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={addExpense} className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50/50 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Particular</label>
            <input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="e.g. Internet" autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
          </div>
          <div className="w-full sm:w-36">
            <label className="mb-1 block text-xs font-medium text-slate-600">Amount</label>
            <input type="number" inputMode="decimal" min={0} value={nAmount} onChange={(e) => setNAmount(e.target.value)} placeholder="0"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
          </div>
          <div className="w-full sm:w-32">
            <label className="mb-1 block text-xs font-medium text-slate-600">Period</label>
            <select value={nPeriod} onChange={(e) => setNPeriod(e.target.value as Period)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200">
              <option value="day">per day</option>
              <option value="month">per month</option>
              <option value="year">per year</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Add</button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-white">Cancel</button>
          </div>
        </form>
      )}

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Particular</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Period</th>
              <th className="px-4 py-3 text-right font-medium">Per day</th>
              <th className="px-2 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">No expenses yet. Click <strong>+ Expense</strong> to add one.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2">
                    <input value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} title="Click to edit"
                      className="w-48 rounded-lg border border-transparent px-2 py-1.5 font-medium text-slate-800 outline-none hover:border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input type="number" inputMode="decimal" min={0} value={r.amount === 0 ? "" : r.amount}
                      onChange={(e) => setRow(r.id, { amount: Math.max(0, Number(e.target.value) || 0) })} placeholder="0" title="Click to edit"
                      className="w-28 rounded-lg border border-transparent px-2 py-1.5 text-right tabular-nums text-slate-700 outline-none hover:border-slate-200 focus:border-brand-500 focus:text-slate-900 focus:ring-2 focus:ring-brand-200" />
                  </td>
                  <td className="px-4 py-2">
                    <select value={r.period} onChange={(e) => setRow(r.id, { period: e.target.value as Period })}
                      className="rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-slate-600 outline-none hover:border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200">
                      <option value="day">per day</option>
                      <option value="month">per month</option>
                      <option value="year">per year</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-900">{fmt(perDay(r))}</td>
                  <td className="px-2 py-2 text-right">
                    <button onClick={() => removeExpense(r.id, r.name)} className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500" title="Delete">✕</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                <td className="px-4 py-3">Total</td>
                <td></td>
                <td></td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.day)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="px-1 text-xs text-slate-400">
        Hover a name, amount or period to edit it. Per-day = amount ÷ 30 (monthly)
        or ÷ 360 (yearly). All changes save together.
      </p>
    </div>
  );
}
