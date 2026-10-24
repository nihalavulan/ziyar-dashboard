import Link from "next/link";

const TILES = [
  {
    href: "/wn/dashboard/food-cost",
    title: "Food Cost",
    description: "Daily ingredient costs for each dish.",
  },
  {
    href: "/wn/dashboard/sop",
    title: "SOP Creator",
    description: "Daily tasks, responsibilities and KPIs for each team member.",
  },
];

export default function WnDashboardPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-white">Private Dashboard</h1>
      <p className="mt-1 text-sm text-slate-400">Pick a section to open.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-2xl border border-white/10 bg-slate-900 p-5 transition hover:border-brand-500 hover:bg-slate-800"
          >
            <p className="font-semibold text-white">{t.title}</p>
            <p className="mt-1 text-sm text-slate-400">{t.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
