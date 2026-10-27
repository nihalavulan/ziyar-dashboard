import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import KitchenWorker from "@/lib/models/KitchenWorker";
import KitchenLog from "@/lib/models/KitchenLog";
import { newWorkerToken, serializeWorker } from "@/lib/kitchen";

export const dynamic = "force-dynamic";

/**
 * PUT  Body: { name?, role?, items?: [{ name, unit, stockItemId? }], resetLink?: true }
 * resetLink gives a new private link; the old link (and installed app) stops working.
 */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const body = await request.json();
    const update: Record<string, unknown> = {};
    if (typeof body?.name === "string") {
      if (!body.name.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
      update.name = body.name.trim();
    }
    if (typeof body?.role === "string") update.role = body.role.trim();
    if (Array.isArray(body?.items)) {
      const seen = new Set<string>();
      update.items = body.items
        .map((i: any) => ({
          name: typeof i?.name === "string" ? i.name.trim().slice(0, 80) : "",
          unit: typeof i?.unit === "string" && i.unit.trim() ? i.unit.trim().slice(0, 20) : "kg",
          stockItemId: typeof i?.stockItemId === "string" ? i.stockItemId : "",
        }))
        .filter((i: any) => {
          const k = i.name.toLowerCase();
          if (!i.name || seen.has(k)) return false;
          seen.add(k);
          return true;
        });
    }
    if (body?.resetLink === true) update.token = newWorkerToken();

    await connectToDatabase();
    const doc = await KitchenWorker.findByIdAndUpdate(params.id, update, { new: true }).lean();
    if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ worker: serializeWorker(doc) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** DELETE → removes the person and all their logs. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    await connectToDatabase();
    await KitchenWorker.findByIdAndDelete(params.id);
    await KitchenLog.deleteMany({ workerId: params.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
