"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { todayStr, shiftDate, prettyDate } from "@/app/dashboard/stock/shared";
import {
  AlfahmDay,
  DaySnapshot,
  PortionQty,
  RateCard as Card,
  VARIANTS,
  VARIANT_KEYS,
  VariantKey,
  birdsFromQty,
  calcDay,
  snapshotFrom,
} from "@/lib/alfahm";
import { btnGhost, btnPrimary, cardCls, inputCls, money, num, statCls, thCls } from "./ui";

type QtyForm = Record<VariantKey, Record<keyof PortionQty, string>>;
const PORTIONS: { key: keyof PortionQty; label: string }[] = [
  { key: "q", label: "Quarter" },
  { key: "h", label: "Half" },
  { key: "tq", label: "¾" },
  { key: "f", label: "Full" },
];

const emptyForm = (): QtyForm =>
  Object.fromEntries(VARIANT_KEYS.map((v) => [v, { q: "", h: "", tq: "", f: "" }])) as QtyForm;
const s = (n: number | null | undefined) => (n ? String(n) : "");
const toNum = (v: string) => Math.max(0, Number(v) || 0);
const formToQty = (f: QtyForm) =>
  Object.fromEntries(
    VARIANT_KEYS.map((v) => [v, { q: toNum(f[v].q), h: toNum(f[v].h), tq: toNum(f[v].tq), f: toNum(f[v].f) }])
  ) as Record<VariantKey, PortionQty>;
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dayLabel = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
};

interface Summary {
  date: string;
  birds: number;
  total: number;
  sales: number | null;
  foodCostPct: number | null;
  perBird: number;
}

export default function DailyEntry({
  card,
  onCardChange,
  onDirtyChange,
}: {
  card: Card;
  onCardChange: (c: Card) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [date, setDate] = useState(todayStr());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [saved, setSaved] = useState<AlfahmDay | null>(null);
  const [rate, setRate] = useState("");
  const [rateHint, setRateHint] = useState("");
  const [sales, setSales] = useState("");
  const [form, setForm] = useState<QtyForm>(emptyForm);
  const [recalc, setRecalc] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [historyKey, setHistoryKey] = useState(0); // bump to reload history

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/wn/alfahm/day?date=${d}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load.");
      const day: AlfahmDay | null = data.day;
      setSaved(day);
      setRecalc(false);
      if (day) {
        setRate(s(day.chickenRatePerKg));
        setSales(s(day.sales));
        setForm(
          Object.fromEntries(
            VARIANT_KEYS.map((v) => [v, { q: s(day.qty[v].q), h: s(day.qty[v].h), tq: s(day.qty[v].tq), f: s(day.qty[v].f) }])
          ) as QtyForm
        );
        setRateHint("");
      } else {
        // New day: chicken rate defaults to the last saved day's rate.
        setRate(data.prevRate ? String(data.prevRate.rate) : "");
        setRateHint(data.prevRate ? `from ${dayLabel(data.prevRate.date)}` : "");
        setSales("");
        setForm(emptyForm());
      }
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

  function touch() {
    setDirty(true);
    setMessage("");
  }

  // Rates used for this day: the saved snapshot, or the current rate card for a new day / recalculation.
  const currentSnapshot = useMemo(() => snapshotFrom(card), [card]);
  const snapshot: DaySnapshot = saved && !recalc ? saved.snapshot : currentSnapshot;
  const usingSaved = !!saved && !recalc;
  const ratesDiffer = useMemo(() => {
    if (!saved) return false;
    const a = saved.snapshot;
    const b = currentSnapshot;
    const close = (x: number, y: number) => Math.abs(x - y) < 0.005;
    return (
      !close(a.birdWeightKg, b.birdWeightKg) ||
      VARIANT_KEYS.some((v) => !close(a.base[v], b.base[v]) || !close(a.flavour[v], b.flavour[v]))
    );
  }, [saved, currentSnapshot]);

  const qty = useMemo(() => formToQty(form), [form]);
  const result = useMemo(
    () => calcDay({ chickenRatePerKg: toNum(rate), sales: toNum(sales) || null, qty, snapshot }),
    [rate, sales, qty, snapshot]
  );

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/wn/alfahm/day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, chickenRatePerKg: toNum(rate), sales: toNum(sales) || null, qty, recalc }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to save.");
      setSaved(d.day);
      setRecalc(false);
      setRateHint("");
      setDirty(false);
      setMessage("Saved.");
      setHistoryKey((k) => k + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function removeDay() {
    if (!saved || !confirm(`Delete the alfahm entry for ${prettyDate(date)}?`)) return;
    const res = await fetch(`/api/wn/alfahm/day?date=${date}`, { method: "DELETE" });
    if (!res.ok) return setError("Failed to delete.");
    setHistoryKey((k) => k + 1);
    load(date);
  }

  const isToday = mounted && date === todayStr();

  return (
    <div className="space-y-5">
      {/* Date bar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-white">{mounted ? prettyDate(date) : ""}</p>
          <p className="text-xs text-slate-400">
            {saved ? (usingSaved ? "Saved" : "Saved — recalculating with current rates (not saved yet)") : "Not saved yet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(shiftDate(date, -1))} className="rounded-lg border border-white/10 px-3 py-2 text-slate-300 hover:bg-white/5" aria-label="Previous day">‹</button>
          <input type="date" value={date} onChange={(e) => e.target.value && changeDate(e.target.value)} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white [color-scheme:dark]" />
          <button onClick={() => changeDate(shiftDate(date, 1))} className="rounded-lg border border-white/10 px-3 py-2 text-slate-300 hover:bg-white/5" aria-label="Next day">›</button>
          {mounted && !isToday && (
            <button onClick={() => changeDate(todayStr())} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/15">Today</button>
          )}
        </div>
      </div>

      {/* Inputs */}
      <section className={`${cardCls} ${loading ? "opacity-60" : ""}`}>
        <div className="grid gap-3 border-b border-white/10 p-4 sm:grid-cols-3">
          <label className="text-xs text-slate-400">
            Chicken rate / kg (₹){rateHint && <span className="text-slate-500"> · {rateHint}</span>}
            <input className={`${inputCls} mt-1`} type="number" min="0" step="any" inputMode="decimal" value={rate} onChange={(e) => { setRate(e.target.value); touch(); }} />
          </label>
          <label className="text-xs text-slate-400">
            Alfahm sales ₹ (optional, for food cost %)
            <input className={`${inputCls} mt-1`} type="number" min="0" step="any" inputMode="decimal" value={sales} onChange={(e) => { setSales(e.target.value); touch(); }} />
          </label>
          <div className="text-xs text-slate-400">
            Rates used
            <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
              <span className="text-slate-300">
                {usingSaved ? `rates from ${shortDate(snapshot.takenAt)}` : card.updatedAt ? `current rate card (${shortDate(card.updatedAt)})` : "current rate card (starting figures)"}
              </span>
              {saved && usingSaved && (
                <button
                  onClick={() => { setRecalc(true); touch(); }}
                  className={`text-xs font-medium ${ratesDiffer ? "text-amber-300" : "text-brand-300"} hover:underline`}
                  title={ratesDiffer ? "The rate card has changed since this day was saved" : undefined}
                >
                  Recalculate with current rates{ratesDiffer ? " •" : ""}
                </button>
              )}
              {recalc && (
                <button onClick={() => { setRecalc(false); }} className="text-xs text-slate-400 hover:underline">
                  Keep saved rates
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Variant · qty sold</th>
                {PORTIONS.map((p) => (
                  <th key={p.key} className={`w-24 ${thCls}`}>{p.label}</th>
                ))}
                <th className={`w-24 ${thCls} pr-4 text-right`}>Birds</th>
              </tr>
            </thead>
            <tbody>
              {VARIANTS.map((v) => (
                <tr key={v.key} className="border-t border-white/5">
                  <td className="px-4 py-2 text-white">{v.label}</td>
                  {PORTIONS.map((p) => (
                    <td key={p.key} className="px-2 py-2">
                      <input
                        className={inputCls}
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={form[v.key][p.key]}
                        placeholder="0"
                        onChange={(e) => {
                          const val = e.target.value;
                          setForm((f) => ({ ...f, [v.key]: { ...f[v.key], [p.key]: val } }));
                          touch();
                        }}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-2 pr-4 text-right tabular-nums text-slate-200">{num(birdsFromQty(qty[v.key]))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 pb-3 text-xs text-slate-500">Mandi and meat-only are counted together. Birds = (Quarter + 2×Half + 3×¾ + 4×Full) ÷ 4.</p>
      </section>

      {/* Day result */}
      <section className={cardCls}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="text-right text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 text-left font-medium">Variant</th>
                <th className={thCls}>Birds</th>
                <th className={thCls}>Chicken ₹</th>
                <th className={thCls}>Base ₹</th>
                <th className={thCls}>Flavour ₹</th>
                <th className={thCls}>Total ₹</th>
                <th className={`${thCls} pr-4`}>Cost / bird</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.key} className="border-t border-white/5 text-right tabular-nums text-slate-200">
                  <td className="px-4 py-2 text-left text-white">{VARIANTS.find((v) => v.key === r.key)?.label}</td>
                  <td className="px-2 py-2">{num(r.birds)}</td>
                  <td className="px-2 py-2">{num(r.chicken)}</td>
                  <td className="px-2 py-2">{num(r.base)}</td>
                  <td className="px-2 py-2">{num(r.flavour)}</td>
                  <td className="px-2 py-2 font-medium text-white">{num(r.total)}</td>
                  <td className="px-2 py-2 pr-4">{r.birds > 0 ? money(r.perBird, 1) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/10 text-right font-semibold tabular-nums text-white">
                <td className="px-4 py-3 text-left">Total</td>
                <td className="px-2 py-3">{num(result.birds)}</td>
                <td className="px-2 py-3">{num(result.chicken)}</td>
                <td className="px-2 py-3">{num(result.base)}</td>
                <td className="px-2 py-3">{num(result.flavour)}</td>
                <td className="px-2 py-3">{num(result.total)}</td>
                <td className="px-2 py-3 pr-4">{result.birds > 0 ? money(result.perBird, 1) : "—"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {!(toNum(rate) > 0) && <p className="px-4 pb-3 text-xs text-amber-400">Enter today&apos;s chicken rate to include chicken.</p>}
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={statCls}>
          <p className="text-xs font-medium text-slate-400">Birds sold</p>
          <p className="mt-1 text-lg font-semibold text-white">{num(result.birds)}</p>
        </div>
        <div className="rounded-2xl border border-brand-500/50 bg-brand-600/15 p-4">
          <p className="text-xs font-medium text-brand-200">Alfahm food cost</p>
          <p className="mt-1 text-lg font-semibold text-white">{money(result.total)}</p>
        </div>
        {result.foodCostPct !== null ? (
          <div className={statCls}>
            <p className="text-xs font-medium text-slate-400">Food cost %</p>
            <p className="mt-1 text-lg font-semibold text-white">{num(result.foodCostPct, 1)}%</p>
            <p className="text-xs text-slate-500">of {money(toNum(sales))} sales</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 p-4 text-xs text-slate-500">Enter alfahm sales to see food cost %.</div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {saved && (
          <button onClick={removeDay} className="mr-auto rounded-lg px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">Delete this day</button>
        )}
        {error && <span className="text-sm text-red-400">{error}</span>}
        {!error && message && <span className="text-sm text-emerald-400">{message}</span>}
        {!error && !message && dirty && <span className="text-sm text-amber-400">Unsaved changes</span>}
        <button onClick={save} disabled={saving || loading || !dirty} className={btnPrimary}>
          {saving ? "Saving…" : "Save day"}
        </button>
      </div>

      <History reloadKey={historyKey} card={card} onCardChange={onCardChange} onPick={changeDate} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

type Range = "7" | "30" | "custom";

function History({
  reloadKey,
  card,
  onCardChange,
  onPick,
}: {
  reloadKey: number;
  card: Card;
  onCardChange: (c: Card) => void;
  onPick: (date: string) => void;
}) {
  const [range, setRange] = useState<Range>("7");
  const [from, setFrom] = useState(shiftDate(todayStr(), -6));
  const [to, setTo] = useState(todayStr());
  const [days, setDays] = useState<Summary[]>([]);
  const [last30, setLast30] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);

  function pickRange(r: Range) {
    setRange(r);
    if (r !== "custom") {
      const t = todayStr();
      setTo(t);
      setFrom(shiftDate(t, -(Number(r) - 1)));
    }
  }

  useEffect(() => {
    if (from > to) return;
    setLoading(true);
    setError("");
    Promise.all([
      fetch(`/api/wn/alfahm/days?from=${from}&to=${to}`).then((r) => r.json()),
      fetch(`/api/wn/alfahm/days?last=30`).then((r) => r.json()),
    ])
      .then(([a, b]) => {
        if (a.error || b.error) throw new Error(a.error || b.error);
        setDays(a.days ?? []);
        setLast30(b.days ?? []);
      })
      .catch((e) => setError(e.message || "Failed to load history."))
      .finally(() => setLoading(false));
  }, [from, to, reloadKey]);

  const totals = useMemo(() => {
    const birds = days.reduce((t, d) => t + d.birds, 0);
    const cost = days.reduce((t, d) => t + d.total, 0);
    const withSales = days.filter((d) => d.sales);
    const sales = withSales.reduce((t, d) => t + (d.sales ?? 0), 0);
    const costWithSales = withSales.reduce((t, d) => t + d.total, 0);
    return {
      birds,
      cost,
      sales,
      pct: sales > 0 ? (costWithSales / sales) * 100 : null,
      perBird: birds > 0 ? cost / birds : 0,
      avgBirds: days.length ? birds / days.length : 0,
      avgCost: days.length ? cost / days.length : 0,
    };
  }, [days]);

  const actualAvg = last30.length ? last30.reduce((t, d) => t + d.birds, 0) / last30.length : 0;
  const setting = card.settings.avgBirdsPerDay;
  const rounded = Math.round(actualAvg * 10) / 10;

  async function useAsSetting() {
    if (!confirm(`Set average alfahm birds/day to ${rounded} (was ${setting})? This changes marinade cost per bird for new entries.`)) return;
    setApplying(true);
    try {
      const res = await fetch("/api/wn/alfahm/card", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...card, settings: { ...card.settings, avgBirdsPerDay: rounded } }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to update.");
      onCardChange(d.card);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="space-y-3 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-base font-semibold text-white">History</h2>
        <div className="flex flex-wrap items-center gap-2">
          {(["7", "30", "custom"] as Range[]).map((r) => (
            <button key={r} onClick={() => pickRange(r)} className={`rounded-lg px-3 py-1.5 text-xs ${range === r ? "bg-white/10 font-medium text-white" : "text-slate-400 hover:bg-white/5"}`}>
              {r === "custom" ? "Custom" : `Last ${r} days`}
            </button>
          ))}
          {range === "custom" && (
            <>
              <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-white [color-scheme:dark]" />
              <span className="text-xs text-slate-500">to</span>
              <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-white [color-scheme:dark]" />
            </>
          )}
        </div>
      </div>

      {/* Actual birds/day vs setting */}
      {last30.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm">
          <p className="text-slate-300">
            Actual average over the last {last30.length} saved day{last30.length === 1 ? "" : "s"}:{" "}
            <span className="font-semibold text-white">{num(actualAvg, 1)} birds/day</span>
            <span className="text-slate-500"> · setting: {num(setting, 1)}</span>
          </p>
          {Math.abs(rounded - setting) >= 0.1 && (
            <button onClick={useAsSetting} disabled={applying} className={`${btnGhost} bg-white/10 text-white`}>
              {applying ? "Updating…" : "Use this as the setting"}
            </button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className={cardCls}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-right text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className={thCls}>Birds</th>
                <th className={thCls}>Alfahm food cost ₹</th>
                <th className={thCls}>Sales ₹</th>
                <th className={thCls}>Food cost %</th>
                <th className={`${thCls} pr-4`}>Cost / bird</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">Loading…</td>
                </tr>
              )}
              {!loading && days.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">No saved days in this range.</td>
                </tr>
              )}
              {!loading &&
                days.map((d) => (
                  <tr key={d.date} onClick={() => onPick(d.date)} className="cursor-pointer border-t border-white/5 text-right tabular-nums text-slate-200 hover:bg-white/5">
                    <td className="px-4 py-2 text-left text-white">{dayLabel(d.date)}</td>
                    <td className="px-2 py-2">{num(d.birds)}</td>
                    <td className="px-2 py-2">{num(d.total)}</td>
                    <td className="px-2 py-2">{d.sales ? num(d.sales) : "—"}</td>
                    <td className="px-2 py-2">{d.foodCostPct !== null ? `${num(d.foodCostPct, 1)}%` : "—"}</td>
                    <td className="px-2 py-2 pr-4">{d.birds > 0 ? money(d.perBird, 1) : "—"}</td>
                  </tr>
                ))}
            </tbody>
            {!loading && days.length > 0 && (
              <tfoot>
                <tr className="border-t border-white/10 text-right font-semibold tabular-nums text-white">
                  <td className="px-4 py-2 text-left">Total ({days.length} day{days.length === 1 ? "" : "s"})</td>
                  <td className="px-2 py-2">{num(totals.birds)}</td>
                  <td className="px-2 py-2">{num(totals.cost)}</td>
                  <td className="px-2 py-2">{totals.sales ? num(totals.sales) : "—"}</td>
                  <td className="px-2 py-2">{totals.pct !== null ? `${num(totals.pct, 1)}%` : "—"}</td>
                  <td className="px-2 py-2 pr-4">{totals.birds > 0 ? money(totals.perBird, 1) : "—"}</td>
                </tr>
                <tr className="text-right tabular-nums text-slate-400">
                  <td className="px-4 pb-3 text-left text-xs">Average / day</td>
                  <td className="px-2 pb-3">{num(totals.avgBirds, 1)}</td>
                  <td className="px-2 pb-3">{num(totals.avgCost)}</td>
                  <td className="px-2 pb-3" colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      <p className="text-xs text-slate-500">Food cost % in the total uses only days with sales entered. Click a day to open it.</p>
    </section>
  );
}
