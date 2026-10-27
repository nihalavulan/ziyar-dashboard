import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import KitchenWorker from "@/lib/models/KitchenWorker";
import KitchenLog from "@/lib/models/KitchenLog";
import { DATE_RE } from "@/lib/kitchen";

export const dynamic = "force-dynamic";

/** GET ?from=YYYY-MM-DD&to=YYYY-MM-DD → every person's logs in that range. */
export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const from = sp.get("from") ?? "";
    const to = sp.get("to") ?? "";
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return NextResponse.json({ error: "Valid from/to dates are required." }, { status: 400 });
    }
    await connectToDatabase();
    const [workers, logs]: any[] = await Promise.all([
      KitchenWorker.find().sort({ order: 1, createdAt: 1 }).lean(),
      KitchenLog.find({ date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean(),
    ]);
    return NextResponse.json({
      workers: workers.map((w: any) => ({
        id: String(w._id),
        name: w.name,
        role: w.role ?? "",
        items: (w.items ?? []).map((i: any) => ({ name: i.name, unit: i.unit || "kg" })),
      })),
      logs: logs.map((l: any) => ({
        workerId: l.workerId,
        date: l.date,
        rows: l.rows ?? [],
        updatedAt: l.updatedAt,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
