"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface Row {
  supplierId: string;
  name: string;
  balance: number;
  purchase: number;
  paid: number;
  total: number;
}

// --- date helpers (local time, no UTC drift) ---
function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function shiftDate(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function prettyDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fmt(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function DailyEntryPage() {
  const [date, setDate] = useState(todayStr());
  // Locale-formatted dates differ between server and browser; render them only
  // after mount to avoid hydration mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string>("");

  // add-supplier form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBalance, setNewBalance] = useState("");

  // edit-balances mode
  const [editingBalance, setEditingBalance] = useState(false);
  const [savingBalance, setSavingBalance] = useState(false);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/daily-entry?date=${d}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load.");
      setRows(data.rows);
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  function updateRow(id: string, field: "purchase" | "paid", value: string) {
    const num = value === "" ? 0 : Number(value);
    if (Number.isNaN(num)) return;
    setRows((prev) =>
      prev.map((r) =>
        r.supplierId === id
          ? { ...r, [field]: num, total: computeTotal({ ...r, [field]: num }) }
          : r
      )
    );
    setDirty(true);
  }

  function computeTotal(r: Row) {
    return r.balance + r.purchase - r.paid;
  }

  function updateBalance(id: string, value: string) {
    const num = value === "" ? 0 : Number(value);
    if (Number.isNaN(num)) return;
    setRows((prev) =>
      prev.map((r) => (r.supplierId === id ? { ...r, balance: num } : r))
    );
  }

  async function saveBalances() {
    setSavingBalance(true);
    setError("");
    try {
      const res = await fetch("/api/daily-entry/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          balances: rows.map((r) => ({
            supplierId: r.supplierId,
            balance: r.balance,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save balances.");
      setEditingBalance(false);
      await load(date);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingBalance(false);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/daily-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          entries: rows.map((r) => ({
            supplierId: r.supplierId,
            purchase: r.purchase,
            paid: r.paid,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString());
      await load(date);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function addSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError("");
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          openingBalance: Number(newBalance) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add supplier.");
      setNewName("");
      setNewBalance("");
      setShowAdd(false);
      await load(date);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function removeSupplier(id: string, name: string) {
    if (
      !confirm(
        `Delete "${name}"? This removes the supplier and ALL of their daily entries. This cannot be undone.`
      )
    )
      return;
    setError("");
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete.");
      await load(date);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        balance: acc.balance + r.balance,
        purchase: acc.purchase + r.purchase,
        paid: acc.paid + r.paid,
        total: acc.total + computeTotal(r),
      }),
      { balance: 0, purchase: 0, paid: 0, total: 0 }
    );
  }, [rows]);

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Ziyar Majlis — Daily Supplier Entry", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(prettyDate(date), 14, 25);

    autoTable(doc, {
      startY: 30,
      head: [["Supplier", "Balance", "Purchase", "Paid", "Total"]],
      body: rows.map((r) => [
        r.name,
        fmt(r.balance),
        fmt(r.purchase),
        fmt(r.paid),
        fmt(computeTotal(r)),
      ]),
      foot: [
        [
          "TOTAL",
          fmt(totals.balance),
          fmt(totals.purchase),
          fmt(totals.paid),
          fmt(totals.total),
        ],
      ],
      headStyles: { fillColor: [0, 36, 34] },
      footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
    });

    const y = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Generated ${new Date().toLocaleString()}`, 14, y);

    doc.save(`daily-entry-${date}.pdf`);
  }

  const isToday = date === todayStr();

  return (
    <div className="space-y-5">
      {/* Header / controls */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDate((d) => shiftDate(d, -1))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"
            aria-label="Previous day"
          >
            ‹
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
          <button
            onClick={() => setDate((d) => shiftDate(d, 1))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"
            aria-label="Next day"
          >
            ›
          </button>
          {!isToday && (
            <button
              onClick={() => setDate(todayStr())}
              className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              Today
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editingBalance ? (
            <>
              <button
                onClick={saveBalances}
                disabled={savingBalance}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {savingBalance ? "Saving…" : "Save balances"}
              </button>
              <button
                onClick={() => {
                  setEditingBalance(false);
                  load(date);
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditingBalance(true)}
                disabled={rows.length === 0}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Edit balances
              </button>
              <button
                onClick={() => setShowAdd((s) => !s)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                + Supplier
              </button>
              <button
                onClick={exportPdf}
                disabled={rows.length === 0}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Export PDF
              </button>
              <button
                onClick={save}
                disabled={saving || !dirty}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : dirty ? "Save" : "Saved"}
              </button>
            </>
          )}
        </div>
      </div>

      <p className="px-1 text-sm text-slate-500">
        {mounted ? prettyDate(date) : " "}
        {savedAt && !dirty && (
          <span className="ml-2 text-xs text-green-600">
            · saved {savedAt}
          </span>
        )}
      </p>

      {/* Add supplier form */}
      {showAdd && (
        <form
          onSubmit={addSupplier}
          className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50/50 p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Supplier name
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Al Noor Vegetables"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              autoFocus
            />
          </div>
          <div className="w-full sm:w-48">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Opening balance (owed)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 text-right font-medium">Balance</th>
              <th className="px-4 py-3 text-right font-medium">Purchase</th>
              <th className="px-4 py-3 text-right font-medium">Paid</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-2 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  No suppliers yet. Click <strong>+ Supplier</strong> to add one.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.supplierId}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    {r.name}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                    {editingBalance ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={r.balance === 0 ? "" : r.balance}
                        onChange={(e) =>
                          updateBalance(r.supplierId, e.target.value)
                        }
                        placeholder="0"
                        className="w-24 rounded-lg border border-brand-300 bg-brand-50/40 px-2 py-1.5 text-right tabular-nums outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                      />
                    ) : (
                      fmt(r.balance)
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={r.purchase === 0 ? "" : r.purchase}
                      onChange={(e) =>
                        updateRow(r.supplierId, "purchase", e.target.value)
                      }
                      placeholder="0"
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right tabular-nums outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={r.paid === 0 ? "" : r.paid}
                      onChange={(e) =>
                        updateRow(r.supplierId, "paid", e.target.value)
                      }
                      placeholder="0"
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right tabular-nums outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                    {fmt(computeTotal(r))}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <button
                      onClick={() => removeSupplier(r.supplierId, r.name)}
                      className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                      aria-label={`Delete ${r.name}`}
                      title="Delete supplier"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmt(totals.balance)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmt(totals.purchase)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmt(totals.paid)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmt(totals.total)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="px-1 text-xs text-slate-400">
        Total = Balance + Purchase − Paid. Each day&apos;s total carries forward
        as the next day&apos;s balance automatically.
      </p>
    </div>
  );
}
