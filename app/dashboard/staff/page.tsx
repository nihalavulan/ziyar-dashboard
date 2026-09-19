"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SectionTabs from "@/components/SectionTabs";

const TABS = [
  { label: "Daily Salary", href: "/dashboard/staff" },
  { label: "Pending", href: "/dashboard/staff/pending" },
];

interface Row {
  staffId: string;
  name: string;
  section: string;
  salary: number;
  present: boolean;
  pending: boolean;
}
interface PartTime {
  name: string;
  section: string;
  salary: number;
  present: boolean;
  pending: boolean;
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

export default function StaffSalaryPage() {
  const [date, setDate] = useState(todayStr());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [rows, setRows] = useState<Row[]>([]);
  const [partTime, setPartTime] = useState<PartTime[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [nName, setNName] = useState("");
  const [nSection, setNSection] = useState("");
  const [nSalary, setNSalary] = useState("");

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/salary?date=${d}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load.");
      setRows(data.rows);
      setPartTime(
        data.partTime.map((p: any) => ({
          name: p.name,
          section: p.section,
          salary: p.salary,
          present: p.present,
          pending: p.pending,
        }))
      );
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
      setPartTime([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  function setRow(id: string, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => (r.staffId === id ? { ...r, ...patch } : r))
    );
    setDirty(true);
  }
  function setPT(i: number, patch: Partial<PartTime>) {
    setPartTime((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
    setDirty(true);
  }
  function addPT() {
    setPartTime((prev) => [
      ...prev,
      { name: "", section: "", salary: 0, present: true, pending: false },
    ]);
    setDirty(true);
  }
  function removePT(i: number) {
    setPartTime((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          rows: rows.map((r) => ({
            staffId: r.staffId,
            present: r.present,
            pending: r.pending,
          })),
          partTime: partTime.filter((p) => p.name.trim()),
        }),
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

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!nName.trim()) return;
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nName.trim(),
          section: nSection.trim(),
          salary: Math.max(0, Number(nSalary) || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add staff.");
      setNName("");
      setNSection("");
      setNSalary("");
      setShowAdd(false);
      await load(date);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function removeStaff(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This removes the staff member and all their salary records.`))
      return;
    try {
      const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete.");
      await load(date);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const totals = useMemo(() => {
    const all = [
      ...rows.map((r) => ({ salary: r.salary, present: r.present, pending: r.pending })),
      ...partTime.map((p) => ({ salary: p.salary, present: p.present, pending: p.pending })),
    ];
    const present = all.filter((x) => x.present);
    const payable = present.reduce((a, x) => a + x.salary, 0);
    const pending = present.filter((x) => x.pending).reduce((a, x) => a + x.salary, 0);
    return {
      presentCount: present.length,
      payable,
      pending,
      payNow: payable - pending,
    };
  }, [rows, partTime]);

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();
    doc.setFontSize(15);
    doc.text("Ziyar Majlis — Daily Salary", 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(prettyDate(date), 14, 24);

    const body = [
      ...rows.map((r) => [
        r.name,
        r.section,
        r.present ? fmt(r.salary) : "-",
        r.present ? (r.pending ? "Pending" : "Paid") : "Absent",
      ]),
      ...partTime
        .filter((p) => p.name.trim())
        .map((p) => [
          `${p.name} (PT)`,
          p.section,
          p.present ? fmt(p.salary) : "-",
          p.present ? (p.pending ? "Pending" : "Paid") : "Absent",
        ]),
    ];

    autoTable(doc, {
      startY: 30,
      head: [["Name", "Section", "Salary", "Status"]],
      body,
      foot: [
        ["Payable", "", fmt(totals.payable), ""],
        ["Paid now", "", fmt(totals.payNow), ""],
        ["Pending", "", fmt(totals.pending), ""],
      ],
      headStyles: { fillColor: [0, 36, 34] },
      footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: { 2: { halign: "right" } },
    });
    doc.save(`daily-salary-${date}.pdf`);
  }

  const isToday = date === todayStr();

  return (
    <div className="space-y-5">
      <SectionTabs tabs={TABS} />

      {/* Controls */}
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
          <button
            onClick={() => setShowAdd((s) => !s)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + Staff
          </button>
          <button
            onClick={exportPdf}
            disabled={rows.length === 0 && partTime.length === 0}
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
        </div>
      </div>

      <p className="px-1 text-sm text-slate-500">{mounted ? prettyDate(date) : " "}</p>

      {/* Add staff form */}
      {showAdd && (
        <form
          onSubmit={addStaff}
          className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50/50 p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
            <input
              value={nName}
              onChange={(e) => setNName(e.target.value)}
              placeholder="e.g. Rahim"
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Section</label>
            <input
              value={nSection}
              onChange={(e) => setNSection(e.target.value)}
              placeholder="e.g. Kitchen"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div className="w-full sm:w-36">
            <label className="mb-1 block text-xs font-medium text-slate-600">Daily salary</label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={nSalary}
              onChange={(e) => setNSalary(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Add
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-white">
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Present" value={`${totals.presentCount}`} />
        <Stat label="Payable today" value={fmt(totals.payable)} />
        <Stat label="Paying now" value={fmt(totals.payNow)} />
        <Stat label="Marked pending" value={fmt(totals.pending)} primary />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Section</th>
              <th className="px-4 py-3 text-right font-medium">Salary</th>
              <th className="px-4 py-3 text-center font-medium">Attendance</th>
              <th className="px-4 py-3 text-center font-medium">Pending</th>
              <th className="px-2 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">Loading…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  No staff yet. Click <strong>+ Staff</strong> to add one.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.staffId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{r.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{r.section || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{fmt(r.salary)}</td>
                  <td className="px-4 py-2.5">
                    <Attendance
                      present={r.present}
                      onChange={(present) => setRow(r.staffId, { present, pending: present ? r.pending : false })}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={r.pending}
                      disabled={!r.present}
                      onChange={(e) => setRow(r.staffId, { pending: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-40"
                    />
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <button
                      onClick={() => removeStaff(r.staffId, r.name)}
                      className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                      title="Delete staff"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}

            {/* Part-time section */}
            <tr className="bg-slate-50">
              <td colSpan={6} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Part-time (this day only)
              </td>
            </tr>
            {partTime.map((p, i) => (
              <tr key={`pt-${i}`} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2">
                  <input
                    value={p.name}
                    onChange={(e) => setPT(i, { name: e.target.value })}
                    placeholder="Name"
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={p.section}
                    onChange={(e) => setPT(i, { section: e.target.value })}
                    placeholder="Section"
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={p.salary === 0 ? "" : p.salary}
                    onChange={(e) => setPT(i, { salary: Math.max(0, Number(e.target.value) || 0) })}
                    placeholder="0"
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right tabular-nums outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  />
                </td>
                <td className="px-4 py-2">
                  <Attendance
                    present={p.present}
                    onChange={(present) => setPT(i, { present, pending: present ? p.pending : false })}
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={p.pending}
                    disabled={!p.present}
                    onChange={(e) => setPT(i, { pending: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-40"
                  />
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    onClick={() => removePT(i)}
                    className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                    title="Remove"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={6} className="px-4 py-2.5">
                <button
                  onClick={addPT}
                  className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50"
                >
                  + Add part-time worker
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="px-1 text-xs text-slate-400">
        Attendance defaults to the previous day. Tick <strong>Pending</strong> to
        defer that person&apos;s salary — it shows up under the Pending tab to pay
        later.
      </p>
    </div>
  );
}

function Attendance({
  present,
  onChange,
}: {
  present: boolean;
  onChange: (present: boolean) => void;
}) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-xs">
        <button
          onClick={() => onChange(true)}
          className={`px-3 py-1.5 font-medium transition ${
            present ? "bg-green-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
          }`}
        >
          Present
        </button>
        <button
          onClick={() => onChange(false)}
          className={`px-3 py-1.5 font-medium transition ${
            !present ? "bg-slate-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
          }`}
        >
          Absent
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${primary ? "border-brand-600 bg-brand-50/40" : "border-slate-200 bg-white"}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
