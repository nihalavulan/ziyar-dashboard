"use client";

import { useCallback, useEffect, useState } from "react";
import SectionTabs from "@/components/SectionTabs";

const TABS = [
  { label: "Daily Salary", href: "/dashboard/staff" },
  { label: "Pending", href: "/dashboard/staff/pending" },
];

interface Entry {
  id: string;
  date: string;
  salary: number;
  isPartTime: boolean;
}
interface Person {
  name: string;
  section: string;
  total: number;
  count: number;
  entries: Entry[];
}

function prettyDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function PendingPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/salary/pending");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load.");
      setPeople(data.people);
      setGrandTotal(data.grandTotal);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function settle(body: object, label: string) {
    if (!confirm(`Mark ${label} as paid? This clears it from pending.`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/salary/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to settle.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionTabs tabs={TABS} />

      <div className="flex items-center justify-between rounded-2xl border border-brand-600 bg-brand-50/40 p-5 shadow-sm">
        <div>
          <p className="text-xs font-medium text-slate-500">Total pending salary</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {fmt(grandTotal)}
          </p>
        </div>
        <span className="text-3xl">🕒</span>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
      ) : people.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
          No pending salaries. Everyone&apos;s settled. 🎉
        </div>
      ) : (
        <div className="space-y-3">
          {people.map((p) => (
            <div key={p.name} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 p-4">
                <button
                  onClick={() => setOpen(open === p.name ? null : p.name)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <span className="text-slate-400">{open === p.name ? "▾" : "▸"}</span>
                  <div>
                    <p className="font-medium text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.section || "—"} · {p.count} day{p.count > 1 ? "s" : ""}
                    </p>
                  </div>
                </button>
                <div className="text-right">
                  <p className="font-semibold tabular-nums text-slate-900">{fmt(p.total)}</p>
                </div>
                <button
                  onClick={() => settle({ name: p.name }, `all of ${p.name}'s pending`)}
                  disabled={busy}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Mark paid
                </button>
              </div>

              {open === p.name && (
                <div className="border-t border-slate-100 px-4 py-2">
                  {p.entries.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span className="text-slate-600">
                        {prettyDate(e.date)}
                        {e.isPartTime && (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                            part-time
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums text-slate-800">{fmt(e.salary)}</span>
                        <button
                          onClick={() => settle({ ids: [e.id] }, `${prettyDate(e.date)} (${fmt(e.salary)})`)}
                          disabled={busy}
                          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Paid
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
