"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fmt } from "@/app/dashboard/stock/shared";
import { Masala, masalaBatchCost, masalaCostPerYieldUnit } from "@/lib/masala";

const UNITS = ["kg", "g", "L", "ml", "pcs", "dozen", "packet"];

interface Row {
  name: string;
  qty: string;
  unit: string;
  rate: string;
}
interface Draft {
  name: string;
  rows: Row[];
  yieldQty: string;
  yieldUnit: string;
}

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-white outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";
const n = (v: string) => Math.max(0, Number(v) || 0);
const emptyRow = (): Row => ({ name: "", qty: "", unit: "kg", rate: "" });

const toDraft = (m: Masala): Draft => ({
  name: m.name,
  rows: m.rows.map((r) => ({
    name: r.name,
    qty: r.qty ? String(r.qty) : "",
    unit: r.unit,
    rate: r.rate ? String(r.rate) : "",
  })),
  yieldQty: m.yieldQty ? String(m.yieldQty) : "",
  yieldUnit: m.yieldUnit,
});

const draftNumbers = (d: Draft) => ({
  rows: d.rows.map((r) => ({ name: r.name, qty: n(r.qty), unit: r.unit, rate: n(r.rate) })),
  yieldQty: n(d.yieldQty),
});

export default function MasalaPage() {
  const [masalas, setMasalas] = useState<Masala[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    fetch("/api/wn/masalas")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setMasalas(d.masalas ?? []);
        if (d.masalas?.length) open(d.masalas[0]);
      })
      .catch((e) => setError(e.message || "Failed to load."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function open(m: Masala) {
    setActive(m.id);
    setDraft(toDraft(m));
    setDirty(false);
    setMessage("");
    setError("");
  }

  function pick(m: Masala) {
    if (m.id === active) return;
    if (dirty && !confirm("You have unsaved changes. Leave this masala without saving?")) return;
    open(m);
  }

  function change(patch: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
    setMessage("");
  }

  function setRow(i: number, patch: Partial<Row>) {
    if (!draft) return;
    change({ rows: draft.rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  }

  async function addMasala(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (dirty && !confirm("You have unsaved changes. Leave this masala without saving?")) return;
    setError("");
    const res = await fetch("/api/wn/masalas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, yieldUnit: "kg" }),
    });
    const d = await res.json();
    if (!res.ok) return setError(d.error || "Failed to add.");
    setMasalas((ms) => [...ms, d.masala]);
    open(d.masala);
    setDraft((dr) => (dr ? { ...dr, rows: [emptyRow()] } : dr));
    setNewName("");
    setAdding(false);
  }

  async function save() {
    if (!draft || !active) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/wn/masalas/${active}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, yieldUnit: draft.yieldUnit, ...draftNumbers(draft) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to save.");
      setMasalas((ms) => ms.map((m) => (m.id === active ? d.masala : m)));
      setDraft(toDraft(d.masala));
      setDirty(false);
      setMessage("Saved. New Food Cost rows use this cost from now on.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const m = masalas.find((x) => x.id === active);
    if (!m || !confirm(`Delete ${m.name}? Days that already used it keep their figures.`)) return;
    const res = await fetch(`/api/wn/masalas/${m.id}`, { method: "DELETE" });
    if (!res.ok) return setError("Failed to delete.");
    const rest = masalas.filter((x) => x.id !== m.id);
    setMasalas(rest);
    if (rest.length) open(rest[0]);
    else {
      setActive(null);
      setDraft(null);
    }
  }

  const live = useMemo(() => (draft ? draftNumbers(draft) : null), [draft]);
  const batchCost = live ? masalaBatchCost(live) : 0;
  const perUnit = live ? masalaCostPerYieldUnit(live) : 0;
  const yu = draft?.yieldUnit ?? "kg";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Masala recipes</h1>
          <p className="mt-1 text-sm text-slate-400">
            Masalas made in batches. Enter the recipe and how much one batch makes — the cost per {yu} is worked out for you,
            and you can use it in <Link href="/wn/dashboard/food-cost" className="text-brand-300 underline">Food Cost</Link>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {masalas.map((m) => (
          <button
            key={m.id}
            onClick={() => pick(m)}
            className={`rounded-2xl border p-4 text-left transition ${
              active === m.id ? "border-brand-500 bg-brand-600/15" : "border-white/10 bg-slate-900 hover:bg-slate-800"
            }`}
          >
            <p className="truncate text-xs font-medium text-slate-400">{m.name}</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {m.yieldQty > 0 ? `₹${fmt(masalaCostPerYieldUnit(m))}` : "—"}
              <span className="text-xs font-normal text-slate-400"> / {m.yieldUnit}</span>
            </p>
          </button>
        ))}
        {adding ? (
          <form onSubmit={addMasala} className="flex flex-col gap-2 rounded-2xl border border-brand-500 bg-slate-900 p-3">
            <input autoFocus className={inputCls} placeholder="e.g. Alfaham masala" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setAdding(false)} />
            <div className="flex gap-2">
              <button type="submit" disabled={!newName.trim()} className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">Add</button>
              <button type="button" onClick={() => setAdding(false)} className="rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-white/5">Cancel</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} className="flex min-h-[76px] items-center justify-center rounded-2xl border border-dashed border-white/20 p-4 text-sm text-slate-300 hover:bg-white/5">
            + New masala
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !draft ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
          No masalas yet. Click “+ New masala” to add your first one (e.g. Alfaham masala).
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-slate-900">
          <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
            <input className={`${inputCls} max-w-xs font-semibold`} value={draft.name} onChange={(e) => change({ name: e.target.value })} aria-label="Masala name" />
            <div className="flex-1" />
            <button onClick={remove} className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10">Delete masala</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Recipe ingredient</th>
                  <th className="w-24 px-2 py-2 font-medium">Qty</th>
                  <th className="w-28 px-2 py-2 font-medium">Unit</th>
                  <th className="w-28 px-2 py-2 font-medium">Rate / unit (₹)</th>
                  <th className="w-28 px-2 py-2 text-right font-medium">Total (₹)</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {draft.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No recipe ingredients yet.</td>
                  </tr>
                )}
                {draft.rows.map((r, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-4 py-2">
                      <input className={inputCls} value={r.name} placeholder="e.g. Kashmiri chilli powder" onChange={(e) => setRow(i, { name: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <input className={inputCls} type="number" min="0" step="any" inputMode="decimal" value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <select className={inputCls} value={UNITS.includes(r.unit) ? r.unit : "kg"} onChange={(e) => setRow(i, { unit: e.target.value })}>
                        {UNITS.map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input className={inputCls} type="number" min="0" step="any" inputMode="decimal" value={r.rate} onChange={(e) => setRow(i, { rate: e.target.value })} />
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-white">{fmt(n(r.qty) * n(r.rate))}</td>
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => change({ rows: draft.rows.filter((_, x) => x !== i) })} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400" aria-label="Remove ingredient">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-white/10 px-4 py-3">
            <button onClick={() => change({ rows: [...draft.rows, emptyRow()] })} className="rounded-lg border border-dashed border-white/20 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">
              + Add ingredient
            </button>
          </div>

          {/* Batch size + result */}
          <div className="grid gap-3 border-t border-white/10 px-4 py-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-slate-400">One batch makes</p>
              <div className="mt-1 flex gap-2">
                <input className={`${inputCls} w-28`} type="number" min="0" step="any" inputMode="decimal" placeholder="e.g. 5" value={draft.yieldQty} onChange={(e) => change({ yieldQty: e.target.value })} />
                <select className={`${inputCls} w-20`} value={draft.yieldUnit} onChange={(e) => change({ yieldUnit: e.target.value })}>
                  <option value="kg">kg</option>
                  <option value="L">L</option>
                </select>
              </div>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs font-medium text-slate-400">Recipe cost (one batch)</p>
              <p className="mt-1 text-lg font-semibold text-white">₹{fmt(batchCost)}</p>
            </div>
            <div className="rounded-xl bg-brand-600/20 p-3 ring-1 ring-brand-500/40">
              <p className="text-xs font-medium text-brand-200">Cost per {yu}</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {perUnit > 0 ? `₹${fmt(perUnit)}` : "Enter how much it makes"}
              </p>
              {perUnit > 0 && (
                <p className="text-xs text-slate-400">= ₹{fmt(perUnit / 1000)} per {yu === "L" ? "ml" : "g"}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 px-4 py-3">
            {error && <span className="text-sm text-red-400">{error}</span>}
            {!error && message && <span className="text-sm text-emerald-400">{message}</span>}
            {!error && !message && dirty && <span className="text-sm text-amber-400">Unsaved changes</span>}
            <button onClick={save} disabled={saving || !dirty || !draft.name.trim()} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save masala"}
            </button>
          </div>
        </div>
      )}
      {!draft && error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
