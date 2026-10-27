import Link from "next/link";

export default function KitchenTabs({ active }: { active: "people" | "report" }) {
  const tabs = [
    { key: "people", label: "People & links", href: "/wn/dashboard/kitchen" },
    { key: "report", label: "Usage report", href: "/wn/dashboard/kitchen/report" },
  ];
  return (
    <div className="flex gap-1 rounded-xl bg-slate-900 p-1 ring-1 ring-white/10">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`flex-1 rounded-lg px-3 py-1.5 text-center text-sm ${
            active === t.key ? "bg-white/10 font-medium text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
