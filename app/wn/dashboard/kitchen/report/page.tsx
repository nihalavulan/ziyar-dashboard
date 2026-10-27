"use client";

import { useEffect, useMemo, useState } from "react";
import { todayStr, shiftDate, fmt } from "@/app/dashboard/stock/shared";
import KitchenTabs from "../KitchenTabs";

interface RWorker {
  id: string;
  name: string;
  role: string;
  items: { name: string; unit: string }[];
}
interface RLog {
  workerId: string;
  date: string;
  rows: { name: string; qty: number; unit: string }[];
}

const inputCls =
  "rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white [color-scheme:dark] outline-none focus:border-brand-500";

function dayHead(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(y, m - 1, day);
  return {
    wd: dt.toLocaleDateString("en-GB", { weekday: "short" }),
    dm: dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
  };
}

export default function KitchenReportPage() {
  const [to, setTo] = useState(todayStr());
  const [from, setFrom] = useState(shiftDate(todayStr(), -6));
  const [who, setWho] = useState("all");
  const [workers, setWorkers] = useState<RWorker[]>([]);
  const [logs, setLogs] = useState<RLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (from > to) return;
    setLoading(true);
    setError("");
    fetch(`/api/wn/kitchen/report?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setWorkers(d.workers ?? []);
        setLogs(d.logs ?? []);
      })
      .catch((e) => setError(e.message || "Failed to load."))
      .finally(() => setLoading(false));
  }, [from, to]);

  const days = useMemo(() => {
    const out: string[] = [];
    if (from > to) return out;
    for (let d = from; d <= to && out.length < 62; d = shiftDate(d, 1)) out.push(d);
    return out;
  }, [from, to]);

  const shown = who === "all" ? workers : workers.filter((w) => w.id === who);

  function preset(n: number) {
    const t = todayStr();
    setTo(t);
    setFrom(shiftDate(t, -(n - 1)));
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Kitchen Staff</h1>
        <p className="mt-1 text-sm text-slate-400">What each person logged, day by day, with totals.</p>
      </div>

      <KitchenTabs active="report" />

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-400">
          From
          <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className={`${inputCls} mt-1 block`} />
        </label>
        <label className="text-xs text-slate-400">
          To
          <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className={`${inputCls} mt-1 block`} />
        </label>
        <label className="text-xs text-slate-400">
          Person
          <select value={who} onChange={(e) => setWho(e.target.value)} className={`${inputCls} mt-1 block`}>
            <option value="all">Everyone</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.role ? ` · ${w.role}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-1">
          {[7, 14, 30].map((n) => (
            <button key={n} onClick={() => preset(n)} className="rounded-lg bg-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/15">
              {n} days
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300 ring-1 ring-red-500/30">{error}</div>}
      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      {!loading && shown.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">No kitchen staff yet.</div>
      )}

      {shown.map((w) => {
        const mine = logs.filter((l) => l.workerId === w.id);
        const byDate = new Map(mine.map((l) => [l.date, l]));
        // Items: their list first, then anything else they logged in this range.
        const names: { name: string; unit: string }[] = [...w.items];
        const known = new Set(names.map((n) => n.name.toLowerCase()));
        mine.forEach((l) =>
          l.rows.forEach((r) => {
            if (!known.has(r.name.toLowerCase())) {
              known.add(r.name.toLowerCase());
              names.push({ name: r.name, unit: r.unit });
            }
          })
        );
        const qty = (d: string, n: string) =>
          byDate.get(d)?.rows.find((r) => r.name.toLowerCase() === n.toLowerCase())?.qty ?? 0;
        const missing = days.filter((d) => !byDate.has(d)).length;

        return (
          <section key={w.id} className="rounded-2xl border border-white/10 bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
              <p className="font-semibold text-white">
                {w.name}
                {w.role && <span className="font-normal text-slate-400"> · {w.role}</span>}
              </p>
              <p className="text-xs">
                <span className="text-emerald-400">{days.length - missing} saved</span>
                {missing > 0 && <span className="text-red-400"> · {missing} day{missing === 1 ? "" : "s"} missing</span>}
              </p>
            </div>
            {names.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No items on their list.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400">
                      <th className="sticky left-0 z-10 bg-slate-900 px-4 py-2 text-left font-medium">Item</th>
                      {days.map((d) => {
                        const h = dayHead(d);
                        const saved = byDate.has(d);
                        return (
                          <th key={d} className={`whitespace-nowrap px-3 py-2 text-right font-medium ${saved ? "" : "text-red-400/80"}`}>
                            <span className="block">{h.wd}</span>
                            <span className="block">{h.dm}</span>
                          </th>
                        );
                      })}
                      <th className="bg-white/5 px-4 py-2 text-right font-semibold text-white">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {names.map((n) => {
                      const total = days.reduce((s, d) => s + qty(d, n.name), 0);
                      return (
                        <tr key={n.name} className="border-t border-white/5">
                          <td className="sticky left-0 z-10 whitespace-nowrap bg-slate-900 px-4 py-2 text-white">
                            {n.name} <span className="text-xs text-slate-500">{n.unit}</span>
                          </td>
                          {days.map((d) => {
                            const v = qty(d, n.name);
                            return (
                              <td key={d} className={`px-3 py-2 text-right tabular-nums ${byDate.has(d) ? (v ? "text-slate-200" : "text-slate-600") : "bg-red-500/5 text-slate-700"}`}>
                                {byDate.has(d) ? (v ? fmt(v) : "–") : ""}
                              </td>
                            );
                          })}
                          <td className="bg-white/5 px-4 py-2 text-right font-semibold tabular-nums text-white">{total ? fmt(total) : "–"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
