"use client";

import { useEffect, useState } from "react";
import { StatCard, Card } from "@/components/ui";
import { RadialGauge, Bar } from "@/components/charts";

interface Overview {
  date: string;
  totalPending: number;
  supplierCount: number;
  activeSuppliers: number;
  allPurchase: number;
  allPaid: number;
  monthPurchase: number;
  monthPaid: number;
  todayPurchase: number;
  todayPaid: number;
  paymentRatio: number;
  monthCoverage: number | null;
  topSuppliers: { name: string; balance: number }[];
  last7: { date: string; purchase: number; paid: number }[];
}

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function monthName() {
  return new Date().toLocaleDateString(undefined, { month: "long" });
}

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    (async () => {
      try {
        const res = await fetch(`/api/overview?date=${todayStr()}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Failed to load analytics.");
        setData(d);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
        Loading analytics…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const hasData = data.allPurchase > 0 || data.allPaid > 0 || data.totalPending !== 0;
  const last7Max = Math.max(
    1,
    ...data.last7.flatMap((d) => [d.purchase, d.paid])
  );
  const topMax = Math.max(1, ...data.topSuppliers.map((s) => s.balance));
  const mon = mounted ? monthName() : "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Business Overview</h2>
        <p className="mt-1 text-sm text-slate-500">
          A live snapshot of what the restaurant owes and how payments are tracking.
        </p>
      </div>

      {!hasData && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50/50 px-5 py-4 text-sm text-slate-600">
          No ledger activity yet. As you record daily purchases and payments in{" "}
          <strong>Daily entry</strong>, these analytics will fill in
          automatically.
        </div>
      )}

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Pending"
          value={fmt(data.totalPending)}
          hint="Owed to all suppliers now"
          icon="💰"
        />
        <StatCard
          label={`Purchases · ${mon}`}
          value={fmt(data.monthPurchase)}
          hint="This month"
          icon="🧾"
        />
        <StatCard
          label={`Paid · ${mon}`}
          value={fmt(data.monthPaid)}
          hint="This month"
          icon="✅"
        />
        <StatCard
          label="Active Suppliers"
          value={`${data.activeSuppliers}`}
          hint={`of ${data.supplierCount} total`}
          icon="👥"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Radial gauge */}
        <Card title="Payment Ratio">
          <div className="flex flex-col items-center gap-4 py-2">
            <RadialGauge
              value={data.paymentRatio}
              centerTop={`${Math.round(data.paymentRatio * 100)}%`}
              centerBottom="settled"
            />
            <div className="w-full space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
                  Paid (all time)
                </span>
                <span className="tabular-nums font-medium">
                  {fmt(data.allPaid)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                  Pending
                </span>
                <span className="tabular-nums font-medium">
                  {fmt(data.totalPending)}
                </span>
              </div>
              {data.monthCoverage !== null && (
                <p className="pt-1 text-xs text-slate-400">
                  {mon}: paid {Math.round(data.monthCoverage * 100)}% of what you
                  purchased.
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Top suppliers by pending */}
        <Card title="Top Pending Suppliers">
          {data.topSuppliers.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              No outstanding balances.
            </p>
          ) : (
            <div className="space-y-4">
              {data.topSuppliers.map((s) => (
                <Bar
                  key={s.name}
                  label={s.name}
                  value={s.balance}
                  max={topMax}
                  format={fmt}
                />
              ))}
            </div>
          )}
        </Card>

        {/* 7-day trend */}
        <Card title="Last 7 Days">
          <div className="flex h-44 items-end justify-between gap-2 pt-2">
            {data.last7.map((d) => {
              const day = d.date.slice(8, 10);
              return (
                <div
                  key={d.date}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div className="flex h-32 items-end gap-0.5">
                    <div
                      className="w-2.5 rounded-t bg-brand-600"
                      style={{ height: `${(d.purchase / last7Max) * 100}%` }}
                      title={`Purchase ${fmt(d.purchase)}`}
                    />
                    <div
                      className="w-2.5 rounded-t bg-brand-300"
                      style={{ height: `${(d.paid / last7Max) * 100}%` }}
                      title={`Paid ${fmt(d.paid)}`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">{day}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand-600" /> Purchases
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand-300" /> Paid
            </span>
          </div>
        </Card>
      </div>

      {/* Today strip */}
      <Card title="Today">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Purchases today</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {fmt(data.todayPurchase)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Paid today</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {fmt(data.todayPaid)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total purchased (all)</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {fmt(data.allPurchase)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total paid (all)</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {fmt(data.allPaid)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
