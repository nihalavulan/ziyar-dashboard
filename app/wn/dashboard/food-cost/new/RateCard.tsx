"use client";

import { useEffect, useMemo, useState } from "react";
import {
  RateCard as Card,
  Recipe,
  VARIANTS,
  VARIANT_KEYS,
  VariantKey,
  birdsServed,
  cardDailyCost,
  chickenPerBird,
  isBaseRecipe,
  marinadePerBird,
  perBirdRates,
  rateMissing,
  recipeBatchTotal,
  recipePerDay,
  rowDays,
  rowPerDay,
  rowTotal,
  sharesTotal,
} from "@/lib/alfahm";
import { btnDashed, btnGhost, btnPrimary, cardCls, inputCls, money, num, statCls, thCls } from "./ui";

const UNITS = ["kg", "g", "L", "ml", "pcs", "packet", "bottle", "sack", "dozen"];

/** Form state: numbers kept as strings so fields can be blank while typing. */
interface DRow {
  name: string;
  qty: string;
  unit: string;
  rate: string; // "" = rate missing
  lastsDays: string; // "" = use recipe default
}
interface DRecipe {
  id: string;
  name: string;
  defaultDays: string;
  variants: VariantKey[];
  rows: DRow[];
}
interface Draft {
  avgBirdsPerDay: string;
  birdWeightKg: string;
  chickenRatePerKg: string;
  shares: Record<VariantKey, string>;
  recipes: DRecipe[];
}

const s = (n: number | null | undefined) => (n === null || n === undefined || n === 0 ? "" : String(n));
const toNum = (v: string) => Math.max(0, Number(v) || 0);
const toNumOrNull = (v: string) => (v.trim() === "" || !(Number(v) > 0) ? null : Number(v));

function toDraft(card: Card): Draft {
  return {
    avgBirdsPerDay: s(card.settings.avgBirdsPerDay),
    birdWeightKg: s(card.settings.birdWeightKg),
    chickenRatePerKg: s(card.settings.chickenRatePerKg),
    shares: Object.fromEntries(VARIANT_KEYS.map((v) => [v, s(card.settings.shares[v])])) as Record<VariantKey, string>,
    recipes: card.recipes.map((r) => ({
      id: r.id,
      name: r.name,
      defaultDays: s(r.defaultDays),
      variants: [...r.variants],
      rows: r.rows.map((x) => ({
        name: x.name,
        qty: s(x.qty),
        unit: x.unit,
        rate: s(x.rate),
        lastsDays: s(x.lastsDays),
      })),
    })),
  };
}

function toCard(d: Draft): Card {
  return {
    settings: {
      avgBirdsPerDay: toNum(d.avgBirdsPerDay),
      birdWeightKg: toNum(d.birdWeightKg),
      chickenRatePerKg: toNum(d.chickenRatePerKg),
      shares: Object.fromEntries(VARIANT_KEYS.map((v) => [v, toNum(d.shares[v])])) as Record<VariantKey, number>,
    },
    recipes: d.recipes.map(
      (r): Recipe => ({
        id: r.id,
        name: r.name,
        defaultDays: toNum(r.defaultDays),
        variants: r.variants,
        rows: r.rows.map((x) => ({
          name: x.name,
          qty: toNum(x.qty),
          unit: x.unit,
          rate: toNumOrNull(x.rate),
          lastsDays: toNumOrNull(x.lastsDays),
        })),
      })
    ),
  };
}

const emptyRow = (): DRow => ({ name: "", qty: "", unit: "kg", rate: "", lastsDays: "" });

export default function RateCard({
  card,
  onSaved,
  onDirtyChange,
}: {
  card: Card;
  onSaved: (c: Card) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(card));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const live = useMemo(() => toCard(draft), [draft]);
  const rates = useMemo(() => perBirdRates(live), [live]);
  const cpb = chickenPerBird(live.settings.birdWeightKg, live.settings.chickenRatePerKg);
  const total = sharesTotal(live.settings);
  const sharesOk = Math.abs(total - 100) < 0.05;

  function change(fn: (d: Draft) => Draft) {
    setDraft(fn);
    setDirty(true);
    setMessage("");
  }
  const setRecipe = (i: number, patch: Partial<DRecipe>) =>
    change((d) => ({ ...d, recipes: d.recipes.map((r, x) => (x === i ? { ...r, ...patch } : r)) }));
  const setRow = (ri: number, i: number, patch: Partial<DRow>) =>
    change((d) => ({
      ...d,
      recipes: d.recipes.map((r, x) =>
        x === ri ? { ...r, rows: r.rows.map((row, y) => (y === i ? { ...row, ...patch } : row)) } : r
      ),
    }));

  function toggleVariant(ri: number, v: VariantKey) {
    const cur = draft.recipes[ri].variants;
    setRecipe(ri, { variants: cur.includes(v) ? cur.filter((x) => x !== v) : VARIANT_KEYS.filter((k) => cur.includes(k) || k === v) });
  }

  function addRecipe() {
    change((d) => ({
      ...d,
      recipes: [
        ...d.recipes,
        { id: `recipe-${Date.now()}`, name: "New marinade", defaultDays: "7", variants: [], rows: [emptyRow()] },
      ],
    }));
  }

  function removeRecipe(i: number) {
    if (!confirm(`Remove ${draft.recipes[i].name}? It is only removed once you save.`)) return;
    change((d) => ({ ...d, recipes: d.recipes.filter((_, x) => x !== i) }));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/wn/alfahm/card", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(live),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to save.");
      onSaved(d.card);
      setDraft(toDraft(d.card));
      setDirty(false);
      setMessage("Saved. New daily entries use these rates; saved days keep theirs.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Settings */}
      <section className={`${cardCls} p-4`}>
        <h2 className="text-sm font-semibold text-white">Settings</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-slate-400">
            Average alfahm birds / day
            <input className={`${inputCls} mt-1`} type="number" min="0" step="any" inputMode="decimal" value={draft.avgBirdsPerDay} onChange={(e) => change((d) => ({ ...d, avgBirdsPerDay: e.target.value }))} />
          </label>
          <label className="text-xs text-slate-400">
            Bird weight (kg)
            <input className={`${inputCls} mt-1`} type="number" min="0" step="any" inputMode="decimal" value={draft.birdWeightKg} onChange={(e) => change((d) => ({ ...d, birdWeightKg: e.target.value }))} />
          </label>
          <label className="text-xs text-slate-400">
            Chicken rate / kg (₹, for this table)
            <input className={`${inputCls} mt-1`} type="number" min="0" step="any" inputMode="decimal" placeholder="today's rate" value={draft.chickenRatePerKg} onChange={(e) => change((d) => ({ ...d, chickenRatePerKg: e.target.value }))} />
          </label>
        </div>
        <p className="mt-4 text-xs font-medium text-slate-400">Variant share of alfahm birds (%)</p>
        <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {VARIANTS.map((v) => (
            <label key={v.key} className="text-xs text-slate-400">
              {v.label}
              <input className={`${inputCls} mt-1`} type="number" min="0" step="any" inputMode="decimal" value={draft.shares[v.key]} onChange={(e) => change((d) => ({ ...d, shares: { ...d.shares, [v.key]: e.target.value } }))} />
            </label>
          ))}
        </div>
        <p className={`mt-2 text-xs ${sharesOk ? "text-slate-500" : "font-medium text-amber-400"}`}>
          Total {num(total)}%{!sharesOk && " — shares must add up to 100%"}
        </p>
      </section>

      {/* Recipes */}
      {draft.recipes.map((dr, ri) => {
        const rec = live.recipes[ri];
        const base = isBaseRecipe(rec);
        const served = birdsServed(rec, live.settings);
        return (
          <section key={dr.id} className={cardCls}>
            <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
              <input className={`${inputCls} max-w-xs font-semibold`} value={dr.name} onChange={(e) => setRecipe(ri, { name: e.target.value })} aria-label="Recipe name" />
              <label className="flex items-center gap-2 text-xs text-slate-400">
                One batch lasts
                <input className={`${inputCls} w-16`} type="number" min="0" step="any" value={dr.defaultDays} onChange={(e) => setRecipe(ri, { defaultDays: e.target.value })} />
                days
              </label>
              <div className="flex flex-1 flex-wrap items-center gap-1">
                <span className="text-xs text-slate-500">Serves:</span>
                {VARIANTS.map((v) => {
                  const on = dr.variants.includes(v.key);
                  return (
                    <button
                      key={v.key}
                      onClick={() => toggleVariant(ri, v.key)}
                      className={`rounded-full px-2.5 py-0.5 text-xs ${on ? "bg-brand-500/40 text-white" : "bg-white/5 text-slate-500 hover:text-slate-300"}`}
                    >
                      {v.label}
                    </button>
                  );
                })}
                {base && <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">base · all variants</span>}
              </div>
              <button onClick={() => removeRecipe(ri)} className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-500/10">Remove recipe</button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2 font-medium">Ingredient</th>
                    <th className={`w-20 ${thCls}`}>Qty</th>
                    <th className={`w-28 ${thCls}`}>Unit</th>
                    <th className={`w-28 ${thCls}`}>Rate / unit (₹)</th>
                    <th className={`w-24 ${thCls} text-right`}>Total (₹)</th>
                    <th className={`w-24 ${thCls}`}>Lasts (days)</th>
                    <th className={`w-24 ${thCls} text-right`}>Per day (₹)</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {dr.rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-500">No ingredients yet.</td>
                    </tr>
                  )}
                  {dr.rows.map((row, i) => {
                    const r = rec.rows[i];
                    const missing = row.name.trim() !== "" && rateMissing(r);
                    return (
                      <tr key={i} className={`border-t border-white/5 ${missing ? "bg-amber-500/10" : ""}`}>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <input className={inputCls} value={row.name} placeholder="e.g. garlic" onChange={(e) => setRow(ri, i, { name: e.target.value })} />
                            {missing && <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">rate missing</span>}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <input className={inputCls} type="number" min="0" step="any" inputMode="decimal" value={row.qty} onChange={(e) => setRow(ri, i, { qty: e.target.value })} />
                        </td>
                        <td className="px-2 py-2">
                          <select className={inputCls} value={UNITS.includes(row.unit) ? row.unit : "__other"} onChange={(e) => setRow(ri, i, { unit: e.target.value === "__other" ? row.unit : e.target.value })}>
                            {UNITS.map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                            {!UNITS.includes(row.unit) && <option value="__other">{row.unit}</option>}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input className={`${inputCls} ${missing ? "border-amber-500/60" : ""}`} type="number" min="0" step="any" inputMode="decimal" value={row.rate} onChange={(e) => setRow(ri, i, { rate: e.target.value })} />
                        </td>
                        <td className="px-2 py-2 text-right font-medium text-white">{num(rowTotal(r))}</td>
                        <td className="px-2 py-2">
                          <input className={inputCls} type="number" min="0" step="any" inputMode="decimal" placeholder={`${num(rowDays({ ...r, lastsDays: null }, rec))}`} value={row.lastsDays} onChange={(e) => setRow(ri, i, { lastsDays: e.target.value })} />
                        </td>
                        <td className="px-2 py-2 text-right text-slate-200">{num(rowPerDay(r, rec))}</td>
                        <td className="px-2 py-2 text-right">
                          <button onClick={() => setRecipe(ri, { rows: dr.rows.filter((_, y) => y !== i) })} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400" aria-label="Remove ingredient">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 px-4 py-3 text-sm">
              <button onClick={() => setRecipe(ri, { rows: [...dr.rows, emptyRow()] })} className={btnDashed}>
                + Add ingredient
              </button>
              <div className="flex-1" />
              <Stat label="Batch total" value={money(recipeBatchTotal(rec))} />
              <Stat label="Cost / day" value={money(recipePerDay(rec))} />
              <Stat label="Birds served / day" value={num(served, 2)} />
              <Stat label="Marinade / bird" value={served > 0 ? money(marinadePerBird(rec, live.settings), 1) : "—"} strong />
            </div>
          </section>
        );
      })}

      <button onClick={addRecipe} className={`${btnDashed} w-full py-3`}>
        + Add marinade recipe
      </button>

      {/* Result */}
      <section className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Cost per bird by variant</h2>
          {!(live.settings.chickenRatePerKg > 0) && (
            <span className="text-xs text-amber-400">Enter a chicken rate above to include chicken.</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-right text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 text-left font-medium">Variant</th>
                <th className={thCls}>Chicken</th>
                <th className={thCls}>Base</th>
                <th className={thCls}>Flavour</th>
                <th className={thCls}>Cost / bird</th>
                <th className={thCls}>Quarter</th>
                <th className={thCls}>Half</th>
                <th className={thCls}>¾</th>
                <th className={`${thCls} pr-4`}>Full</th>
              </tr>
            </thead>
            <tbody>
              {VARIANTS.map((v) => {
                const perBird = cpb + rates.base[v.key] + rates.flavour[v.key];
                return (
                  <tr key={v.key} className="border-t border-white/5 text-right tabular-nums text-slate-200">
                    <td className="px-4 py-2 text-left text-white">{v.label}</td>
                    <td className="px-2 py-2">{money(cpb, 1)}</td>
                    <td className="px-2 py-2">{money(rates.base[v.key], 1)}</td>
                    <td className="px-2 py-2">{money(rates.flavour[v.key], 1)}</td>
                    <td className="px-2 py-2 font-semibold text-white">{money(perBird, 1)}</td>
                    <td className="px-2 py-2">{money(perBird / 4, 1)}</td>
                    <td className="px-2 py-2">{money(perBird / 2, 1)}</td>
                    <td className="px-2 py-2">{money(perBird * 0.75, 1)}</td>
                    <td className="px-2 py-2 pr-4">{money(perBird, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={statCls}>
          <p className="text-xs font-medium text-slate-400">Marinades / day</p>
          <p className="mt-1 text-lg font-semibold text-white">{money(live.recipes.reduce((t, r) => t + recipePerDay(r), 0))}</p>
        </div>
        <div className={statCls}>
          <p className="text-xs font-medium text-slate-400">Chicken / day ({num(live.settings.avgBirdsPerDay)} birds)</p>
          <p className="mt-1 text-lg font-semibold text-white">{money(live.settings.avgBirdsPerDay * cpb)}</p>
        </div>
        <div className="rounded-2xl border border-brand-500/50 bg-brand-600/15 p-4">
          <p className="text-xs font-medium text-brand-200">Daily alfahm cost</p>
          <p className="mt-1 text-lg font-semibold text-white">{money(cardDailyCost(live))}</p>
        </div>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur">
        {error && <span className="text-sm text-red-400">{error}</span>}
        {!error && message && <span className="text-sm text-emerald-400">{message}</span>}
        {!error && !message && dirty && <span className="text-sm text-amber-400">Unsaved changes</span>}
        {!error && !message && !dirty && !card.updatedAt && <span className="text-sm text-slate-400">Showing starting figures — save to keep them.</span>}
        {dirty && (
          <button onClick={() => { setDraft(toDraft(card)); setDirty(false); }} className={btnGhost}>
            Undo changes
          </button>
        )}
        <button onClick={save} disabled={saving || (!dirty && !!card.updatedAt) || !sharesOk} className={btnPrimary} title={!sharesOk ? "Shares must add up to 100%" : undefined}>
          {saving ? "Saving…" : "Save rate card"}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="text-right">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={strong ? "font-semibold text-brand-200" : "font-medium text-white"}>{value}</p>
    </div>
  );
}
