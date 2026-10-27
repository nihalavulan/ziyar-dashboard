import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import KitchenWorker from "@/lib/models/KitchenWorker";
import KitchenLog from "@/lib/models/KitchenLog";
import { DATE_RE, cleanRows } from "@/lib/kitchen";

export const dynamic = "force-dynamic";

const notFound = () =>
  NextResponse.json({ error: "This link is not active." }, { status: 404 });

/**
 * GET /api/k/<token>?date=YYYY-MM-DD
 * The person's items, their log for that day, the last earlier log (used to
 * pre-fill a new day), and which of the last 14 days are already saved.
 */
export async function GET(request: Request, { params }: { params: { token: string } }) {
  try {
    const date = new URL(request.url).searchParams.get("date") ?? "";
    if (!DATE_RE.test(date)) {
      return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
    }
    await connectToDatabase();
    const worker: any = await KitchenWorker.findOne({ token: params.token }).lean();
    if (!worker) return notFound();
    KitchenWorker.updateOne({ _id: worker._id }, { lastSeenAt: new Date() }).catch(() => {});

    const workerId = String(worker._id);
    const [log, prev, recent]: any[] = await Promise.all([
      KitchenLog.findOne({ workerId, date }).lean(),
      KitchenLog.findOne({ workerId, date: { $lt: date } }).sort({ date: -1 }).lean(),
      KitchenLog.find({ workerId }).sort({ date: -1 }).limit(14).select("date").lean(),
    ]);

    return NextResponse.json({
      worker: { name: worker.name, role: worker.role },
      items: (worker.items ?? []).map((i: any) => ({ name: i.name, unit: i.unit || "kg" })),
      date,
      log: log ? { rows: log.rows ?? [], updatedAt: log.updatedAt } : null,
      prev: prev ? { date: prev.date, rows: prev.rows ?? [] } : null,
      savedDates: recent.map((r: any) => r.date),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * PUT /api/k/<token>  Body: { date, rows: [{ name, qty, unit }], newItems?: [{ name, unit }] }
 * Saves that day's usage. Items the person added themselves join their list.
 */
export async function PUT(request: Request, { params }: { params: { token: string } }) {
  try {
    const body = await request.json();
    const date = typeof body?.date === "string" ? body.date : "";
    if (!DATE_RE.test(date)) {
      return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
    }
    await connectToDatabase();
    const worker: any = await KitchenWorker.findOne({ token: params.token });
    if (!worker) return notFound();

    const rows = cleanRows(body?.rows);
    const workerId = String(worker._id);
    const log: any = await KitchenLog.findOneAndUpdate(
      { workerId, date },
      { $set: { rows } },
      { upsert: true, new: true }
    ).lean();

    // Add any new items to the person's own list so they show up tomorrow too.
    const known = new Set((worker.items ?? []).map((i: any) => i.name.toLowerCase()));
    const extra = (Array.isArray(body?.newItems) ? body.newItems : [])
      .map((i: any) => ({
        name: typeof i?.name === "string" ? i.name.trim().slice(0, 80) : "",
        unit: typeof i?.unit === "string" && i.unit.trim() ? i.unit.trim().slice(0, 20) : "kg",
      }))
      .filter((i: any) => i.name && !known.has(i.name.toLowerCase()));
    if (extra.length) {
      worker.items.push(...extra);
      await worker.save();
    }

    return NextResponse.json({ ok: true, log: { rows: log.rows, updatedAt: log.updatedAt } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
