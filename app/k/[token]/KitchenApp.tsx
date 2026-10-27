"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const UNITS = ["kg", "g", "L", "ml", "pcs", "packet"];

interface Row {
  name: string;
  unit: string;
  qty: string;
  isNew: boolean; // added on this phone, not yet in the saved list
}

interface Data {
  worker: { name: string; role: string };
  items: { name: string; unit: string }[];
  log: { rows: { name: string; qty: number; unit: string }[]; updatedAt: string } | null;
  prev: { date: string; rows: { name: string; qty: number; unit: string }[] } | null;
  savedDates: string[];
}

// ---------- date helpers (phone's local time) ----------
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function shift(s: string, days: number) {
  const d = toDate(s);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysBetween(a: string, b: string) {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
}
const weekday = (s: string, style: "long" | "short" = "long") =>
  toDate(s).toLocaleDateString("en-GB", { weekday: style });
const longDate = (s: string) =>
  toDate(s).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const shortDate = (s: string) =>
  toDate(s).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const fmtQty = (n: number) => String(Math.round(n * 1000) / 1000);
// Short unit labels so they fit inside the number box.
const SHORT: Record<string, string> = { packet: "pkt", bottle: "btl", dozen: "dz", bundle: "bdl", cylinder: "cyl" };
const shortUnit = (u: string) => SHORT[u.toLowerCase()] ?? (u.length > 4 ? u.slice(0, 4) : u);

function relLabel(date: string, today: string) {
  const diff = daysBetween(date, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1) return `${diff} days ago`;
  return "Future day";
}

function buildRows(data: Data): { rows: Row[]; prefilled: boolean } {
  const source = data.log?.rows ?? data.prev?.rows ?? [];
  const qtyBy = new Map(source.map((r) => [r.name.toLowerCase(), r]));
  const rows: Row[] = data.items.map((it) => {
    const r = qtyBy.get(it.name.toLowerCase());
    return { name: it.name, unit: it.unit, qty: r ? fmtQty(r.qty) : "", isNew: false };
  });
  // Rows saved for this day that are no longer on the list still show.
  if (data.log) {
    const listed = new Set(data.items.map((i) => i.name.toLowerCase()));
    data.log.rows
      .filter((r) => !listed.has(r.name.toLowerCase()))
      .forEach((r) => rows.push({ name: r.name, unit: r.unit, qty: fmtQty(r.qty), isNew: false }));
  }
  return { rows, prefilled: !data.log && !!data.prev && data.prev.rows.length > 0 };
}

export default function KitchenApp({ token }: { token: string }) {
  const [today, setToday] = useState("");
  const [date, setDate] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [prefilled, setPrefilled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [adding, setAdding] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  // Start on today's date once we are in the browser.
  useEffect(() => {
    const t = todayStr();
    setToday(t);
    setDate(t);
  }, []);

  // Register the service worker so the app can be installed.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/k/sw.js", { scope: "/k/" }).catch(() => {});
    }
  }, []);

  const load = useCallback(
    async (d: string) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/k/${token}?date=${d}`, { cache: "no-store" });
        if (res.status === 404) {
          setInvalid(true);
          return;
        }
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not load.");
        setData(json);
        const built = buildRows(json);
        setRows(built.rows);
        setPrefilled(built.prefilled);
        setDirty(false);
      } catch (e) {
        setError((e as Error).message || "No internet. Try again.");
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (date) load(date);
  }, [date, load]);

  // If the app stays open past midnight, move to the new day when reopened.
  useEffect(() => {
    function onShow() {
      if (document.visibilityState !== "visible") return;
      const t = todayStr();
      if (t !== today) {
        setToday(t);
        if (!dirty) setDate(t);
      }
    }
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [today, dirty]);

  // Warn before closing with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  function showToast(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }

  function pickDate(d: string) {
    if (d === date) return;
    if (dirty && !confirm("You have not saved. Leave this day without saving?")) return;
    setDate(d);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setQty(i: number, qty: string) {
    const clean = qty.replace(",", ".").replace(/[^0-9.]/g, "");
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, qty: clean } : r)));
    setDirty(true);
  }

  function step(i: number, by: number) {
    const cur = Number(rows[i].qty) || 0;
    setQty(i, fmtQty(Math.max(0, cur + by)));
  }

  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
    setDirty(true);
  }

  function addRow(name: string, unit: string, qty: string) {
    const exists = rows.findIndex((r) => r.name.toLowerCase() === name.toLowerCase());
    if (exists >= 0) {
      setQty(exists, qty);
    } else {
      setRows((rs) => [...rs, { name, unit, qty, isNew: true }]);
      setDirty(true);
    }
    setAdding(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/k/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          rows: rows.map((r) => ({ name: r.name, unit: r.unit, qty: Number(r.qty) || 0 })),
          newItems: rows.filter((r) => r.isNew).map((r) => ({ name: r.name, unit: r.unit })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save.");
      setData((d) =>
        d
          ? {
              ...d,
              log: json.log,
              items: [
                ...d.items,
                ...rows.filter((r) => r.isNew).map((r) => ({ name: r.name, unit: r.unit })),
              ],
              savedDates: d.savedDates.includes(date) ? d.savedDates : [date, ...d.savedDates],
            }
          : d
      );
      setRows((rs) => rs.map((r) => ({ ...r, isNew: false })));
      setPrefilled(false);
      setDirty(false);
      showToast(`Saved for ${shortDate(date)} ✓`);
    } catch (e) {
      setError((e as Error).message || "No internet. Not saved — try again.");
    } finally {
      setSaving(false);
    }
  }

  const prevBy = useMemo(
    () => new Map((data?.prev?.rows ?? []).map((r) => [r.name.toLowerCase(), r])),
    [data]
  );
  const filledCount = rows.filter((r) => Number(r.qty) > 0).length;
  const saved = !!data?.log;
  const isToday = date === today;
  const strip = useMemo(
    () => (today ? Array.from({ length: 7 }, (_, i) => shift(today, i - 6)) : []),
    [today]
  );

  if (invalid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
        <div>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200 text-2xl">🔒</div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">This link is not active</h1>
          <p className="mt-2 text-slate-600">Ask the manager to send you a new link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-36 text-slate-900">
      {/* Header */}
      <header className="bg-brand-600 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <div className="mx-auto max-w-lg">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-200">Ziyar Majlis · Kitchen</p>
          <p className="mt-0.5 text-lg font-semibold">
            {data?.worker.name ?? " "}
            {data?.worker.role ? <span className="font-normal text-brand-200"> · {data.worker.role}</span> : null}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4">
        {/* Day card: the most important thing on the screen */}
        {date && (
          <section
            className={`-mt-1 rounded-b-3xl rounded-t-none px-5 pb-5 pt-4 shadow-sm ${
              isToday ? "bg-brand-600 text-white" : "bg-amber-400 text-amber-950"
            }`}
          >
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                isToday ? "bg-white/15 text-white" : "bg-amber-950/10 text-amber-950"
              }`}
            >
              {isToday ? "● Today" : `⚠ ${relLabel(date, today)} — not today`}
            </span>
            <p className="mt-2 text-4xl font-extrabold leading-none tracking-tight">{weekday(date)}</p>
            <p className={`mt-1.5 text-xl font-semibold ${isToday ? "text-brand-100" : ""}`}>{longDate(date)}</p>
            {!isToday && (
              <button
                onClick={() => pickDate(today)}
                className="mt-4 w-full rounded-2xl bg-amber-950 py-3 text-base font-semibold text-white active:scale-[0.99]"
              >
                Go back to today
              </button>
            )}
          </section>
        )}

        {/* Last 7 days */}
        <section className="mt-4" aria-label="Pick a day">
          <div className="grid grid-cols-7 gap-1.5">
            {strip.map((d) => {
              const active = d === date;
              const done = data?.savedDates.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => pickDate(d)}
                  className={`flex flex-col items-center rounded-2xl py-2 transition active:scale-95 ${
                    active
                      ? "bg-slate-900 text-white shadow"
                      : "bg-white text-slate-700 ring-1 ring-slate-200"
                  }`}
                >
                  <span className={`text-[11px] font-medium ${active ? "text-slate-300" : "text-slate-500"}`}>
                    {d === today ? "Today" : weekday(d, "short")}
                  </span>
                  <span className="text-lg font-bold leading-tight">{toDate(d).getDate()}</span>
                  <span
                    className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                      done ? "bg-emerald-500" : active ? "bg-slate-600" : "bg-slate-200"
                    }`}
                  />
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" /> = saved
          </p>
        </section>

        <InstallCard />

        {/* Status */}
        {!loading && data && (
          <div
            className={`mt-4 flex items-start gap-3 rounded-2xl p-4 text-sm ${
              saved && !dirty
                ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200"
                : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            <span className="text-lg leading-5">{saved && !dirty ? "✅" : prefilled ? "📋" : "✏️"}</span>
            <div>
              {saved && !dirty ? (
                <>
                  <p className="font-semibold">Saved for {shortDate(date)}</p>
                  <p className="mt-0.5 text-emerald-800">
                    Last saved {new Date(data.log!.updatedAt).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true })}. You can still change and save again.
                  </p>
                </>
              ) : saved && dirty ? (
                <p className="font-semibold">You changed something. Tap Save to update.</p>
              ) : prefilled ? (
                <>
                  <p className="font-semibold">Not saved yet</p>
                  <p className="mt-0.5">
                    Filled with what you used on <b>{shortDate(data.prev!.date)}</b>. Change what is different, then tap Save.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Not saved yet</p>
                  <p className="mt-0.5">Enter how much you used, then tap Save.</p>
                </>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-800 ring-1 ring-red-200">
            {error}
            {!data && (
              <button onClick={() => load(date)} className="ml-2 underline">
                Try again
              </button>
            )}
          </div>
        )}

        {/* Items */}
        {loading && !data ? (
          <div className="mt-4 space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : (
          data && (
            <section className={`mt-4 space-y-2 transition ${loading ? "opacity-50" : ""}`}>
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">What you used</h2>
                <span className="text-xs text-slate-500">
                  {filledCount} of {rows.length} filled
                </span>
              </div>

              {rows.length === 0 && !adding && (
                <div className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  No items yet. Tap <b>Add item</b> below.
                </div>
              )}

              {rows.map((r, i) => {
                const last = prevBy.get(r.name.toLowerCase());
                const has = Number(r.qty) > 0;
                return (
                  <div
                    key={r.name}
                    className={`flex items-center gap-2 rounded-2xl bg-white p-3 ring-1 ${
                      has ? "ring-slate-200" : "ring-slate-200/60"
                    }`}
                  >
                    <label htmlFor={`q-${i}`} className="min-w-0 flex-1">
                      <span className={`block text-base font-semibold leading-tight ${has ? "text-slate-900" : "text-slate-500"}`}>
                        {r.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {r.isNew ? (
                          <button type="button" onClick={() => removeRow(i)} className="text-red-600 underline">
                            Remove
                          </button>
                        ) : last && date !== data.prev?.date ? (
                          `Last time: ${fmtQty(last.qty)} ${last.unit}`
                        ) : (
                          r.unit
                        )}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => step(i, -1)}
                      aria-label={`Less ${r.name}`}
                      className="h-11 w-11 shrink-0 rounded-xl bg-slate-100 text-2xl font-medium text-slate-700 active:bg-slate-200"
                    >
                      −
                    </button>
                    <div className="relative w-24 shrink-0">
                      <input
                        id={`q-${i}`}
                        inputMode="decimal"
                        enterKeyHint="next"
                        value={r.qty}
                        placeholder="0"
                        onChange={(e) => setQty(i, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className={`h-11 w-full rounded-xl border-2 pl-2 pr-10 text-right text-xl font-bold outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 ${
                          has ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-50 text-slate-400"
                        }`}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                        {shortUnit(r.unit)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => step(i, 1)}
                      aria-label={`More ${r.name}`}
                      className="h-11 w-11 shrink-0 rounded-xl bg-slate-100 text-2xl font-medium text-slate-700 active:bg-slate-200"
                    >
                      +
                    </button>
                  </div>
                );
              })}

              {adding ? (
                <AddItemForm onAdd={addRow} onCancel={() => setAdding(false)} />
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-4 text-base font-semibold text-slate-600 active:bg-slate-200/50"
                >
                  <span className="text-xl leading-none">+</span> Add item
                </button>
              )}
              <p className="px-1 pt-1 text-center text-xs text-slate-500">
                Leave empty (0) if you did not use it on this day.
              </p>
            </section>
          )
        )}
      </main>

      {/* Sticky save bar */}
      {data && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto max-w-lg">
            <button
              onClick={save}
              disabled={saving || loading || (saved && !dirty)}
              className={`w-full rounded-2xl py-4 text-lg font-bold transition active:scale-[0.99] disabled:active:scale-100 ${
                saved && !dirty
                  ? "bg-emerald-100 text-emerald-800"
                  : isToday
                  ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20"
                  : "bg-amber-500 text-amber-950 shadow-lg shadow-amber-500/20"
              } disabled:opacity-90`}
            >
              {saving
                ? "Saving…"
                : saved && !dirty
                ? `✓ Saved for ${isToday ? "today" : shortDate(date)}`
                : isToday
                ? `Save for today · ${shortDate(date)}`
                : `Save for ${shortDate(date)}`}
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      <div
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-0 top-4 z-30 flex justify-center px-4 transition-all duration-300 ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
        }`}
      >
        <div className="rounded-2xl bg-slate-900 px-5 py-3 text-base font-semibold text-white shadow-xl">{toast}</div>
      </div>
    </div>
  );
}

function AddItemForm({
  onAdd,
  onCancel,
}: {
  onAdd: (name: string, unit: string, qty: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  const [qty, setQty] = useState("");
  const ok = name.trim() && Number(qty) > 0;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onAdd(name.trim(), unit, qty);
      }}
      className="space-y-3 rounded-2xl bg-white p-4 ring-2 ring-brand-500"
    >
      <p className="text-base font-semibold">Add a new item</p>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Item name (e.g. Garlic)"
        className="h-12 w-full rounded-xl border-2 border-slate-200 px-3 text-base outline-none focus:border-brand-500"
      />
      <div className="flex flex-wrap gap-2">
        {UNITS.map((u) => (
          <button
            type="button"
            key={u}
            onClick={() => setUnit(u)}
            className={`h-10 rounded-xl px-4 text-sm font-semibold ${
              unit === u ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {u}
          </button>
        ))}
      </div>
      <div className="relative">
        <input
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(e.target.value.replace(",", ".").replace(/[^0-9.]/g, ""))}
          placeholder="How much used"
          className="h-12 w-full rounded-xl border-2 border-slate-200 px-3 pr-14 text-lg font-bold outline-none focus:border-brand-500"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">{unit}</span>
      </div>
      <p className="text-xs text-slate-500">It will stay on your list for next days.</p>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="h-12 flex-1 rounded-xl bg-slate-100 font-semibold text-slate-700">
          Cancel
        </button>
        <button type="submit" disabled={!ok} className="h-12 flex-[2] rounded-xl bg-brand-600 font-semibold text-white disabled:opacity-40">
          Add
        </button>
      </div>
    </form>
  );
}

/** Shows how to install the app, unless it is already installed or dismissed. */
function InstallCard() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const [prompt, setPrompt] = useState<any>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem("k-install-dismissed") === "1";
    } catch {}
    if (standalone || dismissed) return;
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setShow(true);
    const h = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", h);
    const done = () => setShow(false);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", h);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem("k-install-dismissed", "1");
    } catch {}
    setShow(false);
  }

  return (
    <div className="mt-4 rounded-2xl bg-white p-4 ring-2 ring-brand-500/40">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/k/icon/192" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Add this app to your phone</p>
          <p className="mt-0.5 text-sm text-slate-600">Open it every day from your home screen. No login needed.</p>
        </div>
      </div>
      {prompt ? (
        <button
          onClick={async () => {
            prompt.prompt();
            const r = await prompt.userChoice;
            if (r?.outcome === "accepted") setShow(false);
            setPrompt(null);
          }}
          className="mt-3 h-12 w-full rounded-xl bg-brand-600 text-base font-semibold text-white"
        >
          Install app
        </button>
      ) : ios ? (
        <ol className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <li>
            1. Tap the <b>Share</b> button{" "}
            <svg viewBox="0 0 24 24" className="inline h-5 w-5 align-text-bottom text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v12M7 8l5-5 5 5M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>{" "}
            at the bottom of Safari
          </li>
          <li>
            2. Tap <b>Add to Home Screen</b>
          </li>
          <li>
            3. Tap <b>Add</b>
          </li>
        </ol>
      ) : (
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          Tap the <b>⋮ menu</b> at the top of Chrome, then <b>Install app</b> or <b>Add to Home screen</b>.
        </p>
      )}
      <button onClick={dismiss} className="mt-2 w-full py-2 text-sm text-slate-500">
        Already added / hide this
      </button>
    </div>
  );
}
