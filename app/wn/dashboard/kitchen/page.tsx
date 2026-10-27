"use client";

import { useEffect, useMemo, useState } from "react";
import { todayStr, shiftDate } from "@/app/dashboard/stock/shared";
import KitchenTabs from "./KitchenTabs";

const UNITS = ["kg", "g", "L", "ml", "pcs", "packet", "dozen", "box", "bottle", "tin"];
const ROLES = ["Mandi master", "Mandi helper", "Alfahm master", "Alfahm helper", "Madhooth master", "Kitchen helper"];

interface WItem {
  name: string;
  unit: string;
  stockItemId: string;
}
interface Worker {
  id: string;
  name: string;
  role: string;
  token: string;
  items: WItem[];
  lastSeenAt: string | null;
  lastLogDate: string | null;
}
interface StockOpt {
  id: string;
  name: string;
  unit: string;
  category: string;
}

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";
const btn = "rounded-lg px-3 py-1.5 text-xs font-medium transition";

function lastSavedLabel(d: string | null) {
  if (!d) return { text: "Never saved", tone: "text-slate-500" };
  const today = todayStr();
  if (d === today) return { text: "Saved today ✓", tone: "text-emerald-400" };
  if (d === shiftDate(today, -1)) return { text: "Last saved yesterday", tone: "text-amber-400" };
  const [y, m, day] = d.split("-").map(Number);
  const label = new Date(y, m - 1, day).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return { text: `Last saved ${label}`, tone: "text-red-400" };
}

export default function KitchenStaffPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [stock, setStock] = useState<StockOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/wn/kitchen/workers")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setWorkers(d.workers ?? []);
        setStock(d.stockItems ?? []);
      })
      .catch((e) => setError(e.message || "Failed to load."))
      .finally(() => setLoading(false));
  }, []);

  const linkFor = (w: Worker) => `${origin}/k/${w.token}`;

  async function addWorker(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError("");
    const res = await fetch("/api/wn/kitchen/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role }),
    });
    const d = await res.json();
    if (!res.ok) return setError(d.error || "Failed to add.");
    setWorkers((ws) => [...ws, d.worker]);
    setName("");
    setRole("");
    setOpenId(d.worker.id);
  }

  async function updateWorker(id: string, patch: Record<string, unknown>) {
    setError("");
    const res = await fetch(`/api/wn/kitchen/workers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Failed to save.");
      return false;
    }
    setWorkers((ws) => ws.map((w) => (w.id === id ? { ...d.worker, lastLogDate: w.lastLogDate } : w)));
    return true;
  }

  async function removeWorker(w: Worker) {
    if (!confirm(`Delete ${w.name}? Their link stops working and all their saved logs are deleted.`)) return;
    const res = await fetch(`/api/wn/kitchen/workers/${w.id}`, { method: "DELETE" });
    if (res.ok) setWorkers((ws) => ws.filter((x) => x.id !== w.id));
  }

  async function resetLink(w: Worker) {
    if (
      !confirm(
        `Make a new link for ${w.name}? The old link and the app on their phone will stop working. You'll need to send them the new link.`
      )
    )
      return;
    await updateWorker(w.id, { resetLink: true });
  }

  async function copy(w: Worker) {
    try {
      await navigator.clipboard.writeText(linkFor(w));
      setCopied(w.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      prompt("Copy this link:", linkFor(w));
    }
  }

  function whatsappHref(w: Worker) {
    const text = `Hi ${w.name}, this is your Ziyar kitchen page. Open it and tap "Add to Home Screen" / "Install app" so you can fill it every day:\n${linkFor(w)}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Kitchen Staff</h1>
        <p className="mt-1 text-sm text-slate-400">
          Each person gets a private link. They install it on their phone and log what they used every day.
        </p>
      </div>

      <KitchenTabs active="people" />

      {error && <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300 ring-1 ring-red-500/30">{error}</div>}

      <form onSubmit={addWorker} className="grid gap-2 rounded-2xl border border-white/10 bg-slate-900 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Rasheed)" className={inputCls} />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (e.g. Mandi master)" list="kitchen-roles" className={inputCls} />
        <datalist id="kitchen-roles">
          {ROLES.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <button disabled={!name.trim()} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-400 disabled:opacity-50">
          Add person
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : workers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
          No kitchen staff yet. Add the first person above.
        </div>
      ) : (
        <div className="space-y-3">
          {workers.map((w) => {
            const s = lastSavedLabel(w.lastLogDate);
            const open = openId === w.id;
            return (
              <div key={w.id} className={`rounded-2xl border bg-slate-900 ${open ? "border-brand-500" : "border-white/10"}`}>
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/30 font-semibold text-white">
                    {w.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white">
                      {w.name}
                      {w.role && <span className="font-normal text-slate-400"> · {w.role}</span>}
                    </p>
                    <p className="text-xs">
                      <span className={s.tone}>{s.text}</span>
                      <span className="text-slate-500">
                        {" "}· {w.items.length} item{w.items.length === 1 ? "" : "s"}
                        {w.lastSeenAt ? "" : " · link not opened yet"}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => copy(w)} className={`${btn} bg-white/10 text-white hover:bg-white/15`}>
                      {copied === w.id ? "Copied ✓" : "Copy link"}
                    </button>
                    <a href={whatsappHref(w)} target="_blank" rel="noreferrer" className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`}>
                      WhatsApp
                    </a>
                    <a href={linkFor(w)} target="_blank" rel="noreferrer" className={`${btn} text-slate-300 hover:bg-white/5`}>
                      Open
                    </a>
                    <button onClick={() => setOpenId(open ? null : w.id)} className={`${btn} text-slate-300 hover:bg-white/5`}>
                      {open ? "Close" : "Edit"}
                    </button>
                  </div>
                </div>
                {open && (
                  <WorkerEditor
                    worker={w}
                    stock={stock}
                    onSave={(patch) => updateWorker(w.id, patch)}
                    onReset={() => resetLink(w)}
                    onDelete={() => removeWorker(w)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WorkerEditor({
  worker,
  stock,
  onSave,
  onReset,
  onDelete,
}: {
  worker: Worker;
  stock: StockOpt[];
  onSave: (patch: Record<string, unknown>) => Promise<boolean>;
  onReset: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(worker.name);
  const [role, setRole] = useState(worker.role);
  const [items, setItems] = useState<WItem[]>(worker.items);
  const [search, setSearch] = useState("");
  const [customName, setCustomName] = useState("");
  const [customUnit, setCustomUnit] = useState("kg");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const dirty =
    name !== worker.name || role !== worker.role || JSON.stringify(items) !== JSON.stringify(worker.items);
  const has = (n: string) => items.some((i) => i.name.toLowerCase() === n.toLowerCase());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stock.filter((s) => !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
  }, [stock, search]);

  function toggleStock(s: StockOpt) {
    setMsg("");
    if (has(s.name)) setItems((is) => is.filter((i) => i.name.toLowerCase() !== s.name.toLowerCase()));
    else setItems((is) => [...is, { name: s.name, unit: s.unit, stockItemId: s.id }]);
  }

  function move(i: number, by: number) {
    const j = i + by;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  }

  async function save() {
    setSaving(true);
    const ok = await onSave({ name, role, items });
    setSaving(false);
    if (ok) setMsg("Saved ✓ — their page shows the new list next time they open it.");
  }

  return (
    <div className="space-y-4 border-t border-white/10 p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-slate-400">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        <label className="text-xs text-slate-400">
          Role
          <input value={role} onChange={(e) => setRole(e.target.value)} list="kitchen-roles" className={`${inputCls} mt-1`} />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Their list */}
        <div>
          <p className="text-sm font-medium text-white">Their items ({items.length})</p>
          <p className="text-xs text-slate-500">In the order they see them. They can also add their own.</p>
          <div className="mt-2 space-y-1">
            {items.length === 0 && <p className="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">No items yet — pick from Stock or add a custom one.</p>}
            {items.map((it, i) => (
              <div key={it.name} className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-sm">
                <span className="flex-1 text-white">
                  {it.name} <span className="text-slate-500">· {it.unit}</span>
                  {!it.stockItemId && <span className="ml-1 rounded bg-white/5 px-1.5 text-[10px] text-slate-400">custom</span>}
                </span>
                <button onClick={() => move(i, -1)} className="px-1 text-slate-400 hover:text-white" aria-label="Move up">↑</button>
                <button onClick={() => move(i, 1)} className="px-1 text-slate-400 hover:text-white" aria-label="Move down">↓</button>
                <button onClick={() => setItems((is) => is.filter((_, x) => x !== i))} className="px-1 text-red-400 hover:text-red-300" aria-label="Remove">✕</button>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = customName.trim();
              if (!n || has(n)) return;
              setItems((is) => [...is, { name: n, unit: customUnit, stockItemId: "" }]);
              setCustomName("");
            }}
            className="mt-2 flex gap-2"
          >
            <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Custom item (e.g. Mandi powder)" className={inputCls} />
            <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} className={`${inputCls} w-24`}>
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
            <button disabled={!customName.trim()} className="rounded-lg bg-white/10 px-3 text-sm text-white hover:bg-white/15 disabled:opacity-40">Add</button>
          </form>
        </div>

        {/* Pick from stock */}
        <div>
          <p className="text-sm font-medium text-white">Pick from Stock</p>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stock items…" className={`${inputCls} mt-2`} />
          <div className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1">
            {stock.length === 0 && <p className="p-4 text-center text-xs text-slate-500">No Stock items yet. Add them in Stock, or use custom items.</p>}
            {filtered.map((s) => {
              const on = has(s.name);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleStock(s)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm ${on ? "bg-brand-500/30 text-white" : "text-slate-300 hover:bg-white/5"}`}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${on ? "border-brand-300 bg-brand-400 text-white" : "border-slate-600"}`}>{on ? "✓" : ""}</span>
                  <span className="flex-1">{s.name}</span>
                  <span className="text-xs text-slate-500">{s.category} · {s.unit}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
        <button onClick={save} disabled={!dirty || saving || !name.trim()} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-400 disabled:opacity-40">
          {saving ? "Saving…" : "Save changes"}
        </button>
        {msg && !dirty && <span className="text-xs text-emerald-400">{msg}</span>}
        <div className="flex-1" />
        <button onClick={onReset} className={`${btn} text-amber-300 hover:bg-amber-500/10`}>New link (old stops working)</button>
        <button onClick={onDelete} className={`${btn} text-red-400 hover:bg-red-500/10`}>Delete person</button>
      </div>
    </div>
  );
}
