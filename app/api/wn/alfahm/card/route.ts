import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import WnAlfahmCard from "@/lib/models/WnAlfahmCard";
import { cleanCard } from "@/lib/alfahm";
import { loadCard } from "@/lib/alfahmStore";

export const dynamic = "force-dynamic";

/** GET /api/wn/alfahm/card → settings + marinade recipes (seed data until first save). */
export async function GET() {
  try {
    await connectToDatabase();
    return NextResponse.json({ card: await loadCard() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** PUT /api/wn/alfahm/card  Body: { settings, recipes } — replaces the rate card. */
export async function PUT(request: Request) {
  try {
    const card = cleanCard(await request.json());
    await connectToDatabase();
    await WnAlfahmCard.updateOne(
      { key: "main" },
      { $set: { key: "main", settings: card.settings, recipes: card.recipes } },
      { upsert: true }
    );
    return NextResponse.json({ card: await loadCard() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
