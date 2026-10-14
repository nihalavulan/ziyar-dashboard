"use client";

import { useEffect, useState } from "react";

interface DayFig {
  date: string;
  sales: number;
  foodCost: number;
  staffFood: number;
  salaryPaid: number;
  fixed: number;
  profit: number;
}
interface Overview {
  date: string;
  fixedDaily: number;
  supplierPending: number;
  salaryPending: number;
  supplierCount: number;
  today: DayFig;
  month: {
    sales: number;
    foodCost: number;
    staffFood: number;
    salaryPaid: number;
    fixed: number;
    profit: number;
    days: number;
  };
  last7: { date: string; sales: number; profit: number }[];
}

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function fmt(n: number) {
  return Math.round(n).toLocaleString();
}
function monthName() {
  return new Date().toLocaleDateString(undefined, { month: "long" });
}

export default function OverviewPage() {
  const [d, setD] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    (async () => {
      try {
        const res = await fetch(`/api/overview?date=${todayStr()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load.");
        setD(data);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return <div className="flex min-h-[50vh] items-center justify-center text-slate-400">Loading dashboard…</div>;
  if (error)
    return <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">{error}</div>;
  if (!d) return null;

  const t = d.today;
  const mon = mounted ? monthName() : "";
  const maxAbs = Math.max(1, ...d.last7.map((x) => Math.abs(x.profit)));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Business Overview</h2>
        <p className="mt-1 text-sm text-slate-500">
          Live snapshot of today&apos;s performance and where the money stands.
        </p>
      </div>

      {/* Today's P&L hero */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Today&apos;s {t.profit >= 0 ? "profit" : "loss"}</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${t.profit >= 0 ? "text-green-700" : "text-red-600"}`}>
              {fmt(t.profit)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <Mini label="Sales" value={t.sales} />
            <Mini label="Food cost" value={t.foodCost} />
            <Mini label="Salary paid" value={t.salaryPaid} />
            <Mini label="Fixed (per day)" value={t.fixed} />
            <Mini label="Staff food" value={t.staffFood} />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Sales today" value={fmt(t.sales)} />
        <Stat label={`Sales · ${mon}`} value={fmt(d.month.sales)} hint={`${d.month.days} day${d.month.days === 1 ? "" : "s"} recorded`} />
        <Stat
          label={`Profit · ${mon}`}
          value={fmt(d.month.profit)}
          valueClass={d.month.profit >= 0 ? "text-green-700" : "text-red-600"}
        />
        <Stat label="Fixed cost / day" value={fmt(d.fixedDaily)} />
      </div>

      {/* Money owed */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <OwedCard
          label="Owed to suppliers"
          value={d.supplierPending}
          hint={`across ${d.supplierCount} suppliers`}
          icon="🧾"
        />
        <OwedCard label="Pending salaries" value={d.salaryPending} hint="unpaid staff salary" icon="👥" />
      </div>

      {/* 7-day profit trend */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Last 7 days — profit / loss</h3>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-green-500" /> Profit</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Loss</span>
          </div>
        </div>
        <div className="flex h-40 items-stretch justify-between gap-2">
          {d.last7.map((x) => {
            const day = x.date.slice(8, 10);
            const h = (Math.abs(x.profit) / maxAbs) * 45;
            return (
              <div key={x.date} className="flex flex-1 flex-col items-center">
                <div className="relative w-full flex-1">
                  <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-slate-200" />
                  {x.profit >= 0 ? (
                    <div
                      className="absolute left-1/2 w-4 -translate-x-1/2 rounded-t bg-green-500"
                      style={{ bottom: "50%", height: `${h}%` }}
                      title={fmt(x.profit)}
                    />
                  ) : (
                    <div
                      className="absolute left-1/2 w-4 -translate-x-1/2 rounded-b bg-red-500"
                      style={{ top: "50%", height: `${h}%` }}
                      title={fmt(x.profit)}
                    />
                  )}
                </div>
                <span className="mt-1.5 text-[10px] text-slate-400">{day}</span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="px-1 text-xs text-slate-400">
        Profit = Sales − Food cost − Staff food − Fixed expenses (per day) − Salary
        paid. Sales count Direct in full and Swiggy/Zomato net of 25% commission.
      </p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-semibold tabular-nums text-slate-800">{fmt(value)}</p>
    </div>
  );
}
function Stat({ label, value, hint, valueClass }: { label: string; value: string; hint?: string; valueClass?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${valueClass ?? "text-slate-900"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
function OwedCard({ label, value, hint, icon }: { label: string; value: number; hint: string; icon: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">{fmt(value)}</p>
        <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
      </div>
      <span className="text-3xl">{icon}</span>
    </div>
  );
}
