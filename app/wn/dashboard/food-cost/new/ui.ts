/** Shared styles for the alfahm cost page (same look as the existing Food Cost page). */
export const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-white outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";
export const cardCls = "rounded-2xl border border-white/10 bg-slate-900";
export const statCls = "rounded-2xl border border-white/10 bg-slate-900 p-4";
export const btnPrimary =
  "rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50";
export const btnGhost = "rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5";
export const btnDashed =
  "rounded-lg border border-dashed border-white/20 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5";
export const thCls = "px-2 py-2 font-medium";

/** ₹ amounts with 2 decimals at most; per-bird figures read better with 1. */
export const money = (n: number, dp = 2) =>
  "₹" + (Number.isFinite(n) ? n : 0).toLocaleString("en-IN", { maximumFractionDigits: dp, minimumFractionDigits: 0 });
export const num = (n: number, dp = 2) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("en-IN", { maximumFractionDigits: dp });
