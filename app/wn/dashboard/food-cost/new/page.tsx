"use client";

import { useEffect, useState } from "react";
import { RateCard as Card } from "@/lib/alfahm";
import DailyEntry from "./DailyEntry";
import RateCard from "./RateCard";

type Tab = "daily" | "card";

/** Alfahm cost: daily entry (default) and the marinade rate card. */
export default function AlfahmCostPage() {
  const [tab, setTab] = useState<Tab>("daily");
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState("");
  // Each tab keeps its own unsaved edits; warn before switching away from them.
  const [dirty, setDirty] = useState<Record<Tab, boolean>>({ daily: false, card: false });

  useEffect(() => {
    fetch("/api/wn/alfahm/card")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCard(d.card);
      })
      .catch((e) => setError(e.message || "Failed to load."));
  }, []);

  function switchTo(next: Tab) {
    if (next === tab) return;
    if (dirty[tab] && !confirm("You have unsaved changes on this tab. Leave without saving?")) return;
    setDirty((d) => ({ ...d, [tab]: false }));
    setTab(next);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Alfahm Cost</h1>
          <p className="mt-1 text-sm text-slate-400">
            Marinades last several days and each flavour serves only its own variants — this costs alfahm per bird and per
            quarter.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl bg-slate-900 p-1 ring-1 ring-white/10">
          {(
            [
              ["daily", "Daily entry"],
              ["card", "Rate card"],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => switchTo(k)}
              className={`rounded-lg px-4 py-1.5 text-sm ${
                tab === k ? "bg-white/10 font-medium text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!card && !error && <p className="text-sm text-slate-500">Loading…</p>}

      {card &&
        (tab === "daily" ? (
          <DailyEntry
            card={card}
            onCardChange={setCard}
            onDirtyChange={(v) => setDirty((d) => ({ ...d, daily: v }))}
          />
        ) : (
          <RateCard
            card={card}
            onSaved={setCard}
            onDirtyChange={(v) => setDirty((d) => ({ ...d, card: v }))}
          />
        ))}
    </div>
  );
}
