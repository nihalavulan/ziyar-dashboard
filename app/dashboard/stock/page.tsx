"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SectionTabs from "@/components/SectionTabs";
import { STOCK_TABS, UNITS, CATEGORIES, todayStr, shiftDate, prettyDate, fmt, num, groupRows } from "./shared";

interface Row {
  itemId: string;
  name: string;
  category: string;
  unit: string;
  opening: number;
  received: number;
  count: number | null; // null = not counted yet
  rate: number;
}

export default function StockPage() {
  const [date, setDate] = useState(todayStr());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [editItems, setEditItems] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [nName, setNName] = useState("");
  const [nCategory, setNCategory] = useState("");
  const [nUnit, setNUnit] = useState("kg");
  const [nRate, setNRate] = useState("");

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/stock?date=${d}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load.");
      setRows(data.rows);
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

  function setRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.itemId === id ? { ...r, ...patch } : r)));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, rows }),
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
    if (dirty && !confirm("You have unsaved changes that will be lost. Add item anyway?")) return;
    try {
      const res = await fetch("/api/stock-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nName.trim(), category: nCategory.trim(), unit: nUnit.trim(), rate: num(nRate) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add item.");
      setNName("");
      setNRate("");
      await load(date);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function removeItem(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This removes the item and all its stock history.`)) return;
    try {
      const res = await fetch(`/api/stock-items/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete.");
      setRows((prev) => prev.filter((r) => r.itemId !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>(CATEGORIES);
    rows.forEach((r) => set.add(r.category));
    return Array.from(set).sort();
  }, [rows]);
  const usedCategories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category))).sort(),
    [rows]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) => (!catFilter || r.category === catFilter) && (!q || r.name.toLowerCase().includes(q))
    );
  }, [rows, search, catFilter]);
  const groups = useMemo(() => groupRows(visible), [visible]);

  // Derived per row: available = opening + received; closing = count (or available if not counted).
  const calc = (r: Row) => {
    const available = r.opening + r.received;
    const closing = r.count === null ? available : r.count;
    const used = r.count === null ? 0 : Math.max(0, available - r.count);
    return { available, closing, used };
  };
  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => {
          const c = calc(r);
          return {
            value: a.value + c.closing * r.rate,
            usedValue: a.usedValue + c.used * r.rate,
            receivedValue: a.receivedValue + r.received * r.rate,
            counted: a.counted + (r.count === null ? 0 : 1),
          };
        },
        { value: 0, usedValue: 0, receivedValue: 0, counted: 0 }
      ),
    [rows]
  );

  function fillUncounted() {
    setRows((prev) =>
      prev.map((r) => (r.count === null ? { ...r, count: r.opening + r.received } : r))
    );
    setDirty(true);
  }

  const isToday = date === todayStr();
  const inputCls =
    "rounded-lg border border-slate-200 px-2 py-1.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

  const SaveBtn = (
    <button onClick={save} disabled={saving || !dirty}
      className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
      {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
    </button>
  );

  return (
    <div className="space-y-5">
      <SectionTabs tabs={STOCK_TABS} />

      {dirty && (
        <div className="sticky top-16 z-20 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 shadow-sm">
          <span><strong className="font-semibold">You have unsaved changes.</strong> Don&apos;t forget to save.</span>
          {SaveBtn}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setDate((d) => shiftDate(d, -1))} className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50" aria-label="Previous day">‹</button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
          <button onClick={() => setDate((d) => shiftDate(d, 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50" aria-label="Next day">›</button>
          {!isToday && <button onClick={() => setDate(todayStr())} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200">Today</button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowAdd((s) => !s)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">+ Item</button>
          <button onClick={() => setEditItems((s) => !s)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${editItems ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
            {editItems ? "Done editing" : "Edit items"}
          </button>
          {SaveBtn}
        </div>
      </div>

      <p className="px-1 text-sm text-slate-500">{mounted ? prettyDate(date) : " "}</p>

      {showAdd && (
        <form onSubmit={addItem} className="grid grid-cols-2 gap-3 rounded-2xl border border-brand-200 bg-brand-50/50 p-4 sm:flex sm:items-end">
          <div className="col-span-2 sm:flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Item</label>
            <input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="e.g. Basmati rice" autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
          </div>
          <div className="col-span-2 sm:w-44">
            <label className="mb-1 block text-xs font-medium text-slate-600">Category</label>
            <input value={nCategory} onChange={(e) => setNCategory(e.target.value)} list="stock-categories" placeholder="Pick or type"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
          </div>
          <div className="sm:w-28">
            <label className="mb-1 block text-xs font-medium text-slate-600">Unit</label>
            <input value={nUnit} onChange={(e) => setNUnit(e.target.value)} list="stock-units" placeholder="kg"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
          </div>
          <div className="sm:w-32">
            <label className="mb-1 block text-xs font-medium text-slate-600">Rate / unit</label>
            <input type="number" inputMode="decimal" min={0} value={nRate} onChange={(e) => setNRate(e.target.value)} placeholder="0"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
          </div>
          <div className="col-span-2 flex gap-2">
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Add</button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-white">Close</button>
          </div>
        </form>
      )}

      <datalist id="stock-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="stock-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary label="Stock value" value={`₹${fmt(totals.value)}`} hint="closing qty × rate" />
        <Summary label="Used today" value={`₹${fmt(totals.usedValue)}`} hint="from counted items" />
        <Summary label="Received today" value={`₹${fmt(totals.receivedValue)}`} />
        <Summary label="Counted" value={`${totals.counted} / ${rows.length}`} hint="items counted today" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 sm:w-64" />
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {["", ...usedCategories].map((c) => (
            <button key={c || "all"} onClick={() => setCatFilter(c)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${catFilter === c ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
              {c || "All"}
            </button>
          ))}
        </div>
        {rows.length > totals.counted && (
          <button onClick={fillUncounted} className="whitespace-nowrap text-xs font-medium text-brand-700 hover:underline sm:ml-auto"
            title="Set each uncounted item's count to its expected stock (no usage)">
            Fill uncounted with expected
          </button>
        )}
      </div>

      {/* Stock table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-3 py-3 font-medium">Unit</th>
              <th className="px-3 py-3 text-right font-medium">Opening</th>
              <th className="px-3 py-3 text-right font-medium">Received</th>
              <th className="px-3 py-3 text-right font-medium">Count</th>
              <th className="px-3 py-3 text-right font-medium">Used</th>
              <th className="px-3 py-3 text-right font-medium">Rate</th>
              <th className="px-4 py-3 text-right font-medium">Value</th>
              {editItems && <th className="px-2 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">No stock items yet. Click <strong>+ Item</strong> to add one.</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">No items match.</td></tr>
            ) : (
              groups.map(([cat, list]) => {
                const catValue = list.reduce((a, r) => a + calc(r).closing * r.rate, 0);
                return [
                  <tr key={`h-${cat}`} className="border-b border-slate-100 bg-slate-50/80">
                    <td colSpan={7} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-brand-700">
                      {cat} <span className="font-normal text-slate-400">· {list.length}</span>
                    </td>
                    <td className="px-4 py-2 text-right text-xs font-semibold tabular-nums text-slate-600">₹{fmt(catValue)}</td>
                    {editItems && <td></td>}
                  </tr>,
                  ...list.map((r) => {
                    const c = calc(r);
                    return (
                      <tr key={r.itemId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-4 py-2">
                          {editItems ? (
                            <div className="flex gap-1.5">
                              <input value={r.name} onChange={(e) => setRow(r.itemId, { name: e.target.value })} className={`${inputCls} w-36 font-medium`} />
                              <input value={r.category} onChange={(e) => setRow(r.itemId, { category: e.target.value })} list="stock-categories" className={`${inputCls} w-28 text-xs`} title="Category" />
                            </div>
                          ) : (
                            <span className="font-medium text-slate-800">{r.name}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {editItems ? (
                            <input value={r.unit} onChange={(e) => setRow(r.itemId, { unit: e.target.value })} list="stock-units" className={`${inputCls} w-20`} />
                          ) : r.unit}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">{fmt(r.opening)}</td>
                        <td className="px-3 py-2 text-right">
                          <input type="number" inputMode="decimal" min={0} value={r.received === 0 ? "" : r.received}
                            onChange={(e) => setRow(r.itemId, { received: num(e.target.value) })} placeholder="0"
                            className={`${inputCls} w-20 text-right tabular-nums`} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input type="number" inputMode="decimal" min={0} value={r.count === null ? "" : r.count}
                            onChange={(e) => setRow(r.itemId, { count: e.target.value === "" ? null : num(e.target.value) })}
                            placeholder={fmt(c.available)} title="Physical count at close (leave blank if not counted)"
                            className={`${inputCls} w-20 text-right tabular-nums placeholder:text-slate-300 ${r.count === null ? "" : "border-brand-300 bg-brand-50/40"}`} />
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${r.count === null ? "text-slate-300" : "font-medium text-slate-800"}`}>
                          {r.count === null ? "—" : fmt(c.used)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input type="number" inputMode="decimal" min={0} value={r.rate === 0 ? "" : r.rate} tabIndex={-1}
                            onChange={(e) => setRow(r.itemId, { rate: num(e.target.value) })} placeholder="0"
                            className={`${inputCls} w-20 text-right tabular-nums`} />
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-900">{fmt(c.closing * r.rate)}</td>
                        {editItems && (
                          <td className="px-2 py-2 text-right">
                            <button onClick={() => removeItem(r.itemId, r.name)} tabIndex={-1} className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500" title="Delete item">✕</button>
                          </td>
                        )}
                      </tr>
                    );
                  }),
                ];
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-3 pt-1">
        {dirty && <span className="text-sm text-amber-600">Unsaved changes</span>}
        {SaveBtn}
      </div>

      <p className="px-1 text-xs text-slate-400">
        Opening = last count + anything received since. Enter what came in under
        Received and the physical count at close under Count; Used = Opening +
        Received − Count. Leave Count blank if an item wasn&apos;t counted — its
        stock carries forward. Value = closing stock × rate.
      </p>
    </div>
  );
}

function Summary({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
