import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import KitchenWorker from "@/lib/models/KitchenWorker";
import KitchenLog from "@/lib/models/KitchenLog";
import StockItem from "@/lib/models/StockItem";
import { newWorkerToken, serializeWorker } from "@/lib/kitchen";

export const dynamic = "force-dynamic";

/** GET → all kitchen people (with their last log day) and the Stock item list to pick from. */
export async function GET() {
  try {
    await connectToDatabase();
    const [workers, stock, last]: any[] = await Promise.all([
      KitchenWorker.find().sort({ order: 1, createdAt: 1 }).lean(),
      StockItem.find().sort({ category: 1, order: 1, name: 1 }).lean(),
      KitchenLog.aggregate([{ $group: { _id: "$workerId", date: { $max: "$date" } } }]),
    ]);
    const lastBy = new Map(last.map((l: any) => [l._id, l.date]));
    return NextResponse.json({
      workers: workers.map((w: any) => serializeWorker(w, lastBy.get(String(w._id)) as string)),
      stockItems: stock.map((s: any) => ({
        id: String(s._id),
        name: s.name,
        unit: s.unit || "kg",
        category: s.category || "Other",
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** POST  Body: { name, role } → creates the person with a fresh private link. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const role = typeof body?.role === "string" ? body.role.trim() : "";
    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    await connectToDatabase();
    const lastW: any = await KitchenWorker.findOne().sort({ order: -1 }).lean();
    const doc = await KitchenWorker.create({
      name,
      role,
      token: newWorkerToken(),
      order: (lastW?.order ?? 0) + 1,
    });
    return NextResponse.json({ worker: serializeWorker(doc) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
