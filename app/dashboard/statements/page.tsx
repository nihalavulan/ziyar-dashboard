"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface StmtRow {
  date: string;
  balance: number;
  purchase: number;
  paid: number;
  total: number;
}
interface Supplier {
  _id: string;
  name: string;
}

type ColKey = "date" | "balance" | "purchase" | "paid" | "total";
const COLUMNS: { key: ColKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "balance", label: "Balance" },
  { key: "purchase", label: "Purchase" },
  { key: "paid", label: "Paid" },
  { key: "total", label: "Total" },
];

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function prettyDate(d: string) {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function StatementsPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [rows, setRows] = useState<StmtRow[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [cols, setCols] = useState<Record<ColKey, boolean>>({
    date: true,
    balance: true,
    purchase: true,
    paid: true,
    total: true,
  });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Load suppliers.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/suppliers");
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Failed to load suppliers.");
        setSuppliers(d.suppliers);
        if (d.suppliers[0]) setSupplierId(d.suppliers[0]._id);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  const loadStatement = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/suppliers/${id}/statement`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to load statement.");
      setRows(d.rows);
      setOpeningBalance(d.openingBalance);
      setCurrentBalance(d.currentBalance);
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (supplierId) loadStatement(supplierId);
  }, [supplierId, loadStatement]);

  const activeCols = COLUMNS.filter((c) => cols[c.key]);
  const supplierName =
    suppliers.find((s) => s._id === supplierId)?.name ?? "";

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      return true;
    });
  }, [rows, from, to]);

  const totals = useMemo(
    () => ({
      purchase: filteredRows.reduce((a, r) => a + r.purchase, 0),
      paid: filteredRows.reduce((a, r) => a + r.paid, 0),
    }),
    [filteredRows]
  );

  function cellValue(r: StmtRow, key: ColKey) {
    if (key === "date") return prettyDate(r.date);
    return fmt(r[key]);
  }

  function toggleCol(key: ColKey) {
    setCols((c) => ({ ...c, [key]: !c[key] }));
  }

  // ---- exports ----
  function exportCsv() {
    const header = activeCols.map((c) => c.label).join(",");
    const body = filteredRows
      .map((r) =>
        activeCols
          .map((c) => (c.key === "date" ? r.date : r[c.key]))
          .join(",")
      )
      .join("\n");
    const csv = `${supplierName} statement\n${header}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${supplierName.replace(/\s+/g, "-")}-statement.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();

    doc.setFontSize(15);
    doc.text(`${supplierName} — Statement`, 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(120);
    const range =
      from || to
        ? `${from ? prettyDate(from) : "start"} → ${to ? prettyDate(to) : "today"}`
        : "All dates";
    doc.text(range, 14, 24);
    doc.text(
      `Current balance: ${fmt(currentBalance)}   |   Purchases: ${fmt(
        totals.purchase
      )}   |   Paid: ${fmt(totals.paid)}`,
      14,
      29
    );

    autoTable(doc, {
      startY: 34,
      head: [activeCols.map((c) => c.label)],
      body: filteredRows.map((r) => activeCols.map((c) => cellValue(r, c.key))),
      headStyles: { fillColor: [0, 36, 34] },
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: Object.fromEntries(
        activeCols.map((c, i) => [
          i,
          { halign: c.key === "date" ? "left" : "right" },
        ])
      ) as any,
    });

    doc.save(`${supplierName.replace(/\s+/g, "-")}-statement.pdf`);
  }

  async function exportAllPdf() {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Ziyar Majlis — Supplier Statements", 14, 18);
    let y = 26;

    for (const s of suppliers) {
      const res = await fetch(`/api/suppliers/${s._id}/statement`);
      const d = await res.json();
      const sRows: StmtRow[] = (d.rows || []).filter((r: StmtRow) => {
        if (from && r.date < from) return false;
        if (to && r.date > to) return false;
        return true;
      });
      if (sRows.length === 0) continue;

      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(`${s.name}  (Balance: ${fmt(d.currentBalance)})`, 14, y);

      autoTable(doc, {
        startY: y + 3,
        head: [activeCols.map((c) => c.label)],
        body: sRows.map((r) => activeCols.map((c) => cellValue(r, c.key))),
        headStyles: { fillColor: [0, 36, 34] },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: Object.fromEntries(
          activeCols.map((c, i) => [
            i,
            { halign: c.key === "date" ? "left" : "right" },
          ])
        ) as any,
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    doc.save(`all-suppliers-statements.pdf`);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Statements</h2>
        <p className="mt-1 text-sm text-slate-500">
          View and export a supplier&apos;s history. Pick the columns and date
          range you need.
        </p>
      </div>

      {/* Controls */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Supplier
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            >
              {suppliers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              From
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              To
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div className="flex items-end">
            {(from || to) && (
              <button
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600 hover:bg-slate-200"
              >
                Clear dates
              </button>
            )}
          </div>
        </div>

        {/* Column toggles */}
        <div>
          <p className="mb-2 text-xs font-medium text-slate-600">
            Columns to include
          </p>
          <div className="flex flex-wrap gap-2">
            {COLUMNS.map((c) => (
              <button
                key={c.key}
                onClick={() => toggleCol(c.key)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  cols[c.key]
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {cols[c.key] ? "✓ " : ""}
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Export buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={exportPdf}
            disabled={activeCols.length === 0 || filteredRows.length === 0}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Export PDF
          </button>
          <button
            onClick={exportCsv}
            disabled={activeCols.length === 0 || filteredRows.length === 0}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            onClick={exportAllPdf}
            disabled={activeCols.length === 0}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Export all suppliers (PDF)
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Opening balance" value={fmt(openingBalance)} />
        <SummaryCard label="Total purchases" value={fmt(totals.purchase)} />
        <SummaryCard label="Total paid" value={fmt(totals.paid)} />
        <SummaryCard label="Current balance" value={fmt(currentBalance)} primary />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              {activeCols.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-3 font-medium ${
                    c.key === "date" ? "" : "text-right"
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={activeCols.length || 1}
                  className="px-4 py-10 text-center text-slate-400"
                >
                  Loading…
                </td>
              </tr>
            ) : activeCols.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-slate-400">
                  Select at least one column.
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={activeCols.length}
                  className="px-4 py-12 text-center text-slate-400"
                >
                  No transactions for this supplier{from || to ? " in this range" : ""}.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr
                  key={r.date}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                >
                  {activeCols.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 py-2.5 ${
                        c.key === "date"
                          ? "text-slate-700"
                          : "text-right tabular-nums text-slate-800"
                      }`}
                    >
                      {cellValue(r, c.key)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {filteredRows.length > 0 && activeCols.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                {activeCols.map((c, i) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3 ${
                      c.key === "date" ? "" : "text-right tabular-nums"
                    }`}
                  >
                    {c.key === "date"
                      ? i === 0
                        ? "Total"
                        : ""
                      : c.key === "purchase"
                      ? fmt(totals.purchase)
                      : c.key === "paid"
                      ? fmt(totals.paid)
                      : c.key === "total"
                      ? fmt(currentBalance)
                      : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  primary,
}: {
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        primary ? "border-brand-600 bg-brand-50/40" : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}
