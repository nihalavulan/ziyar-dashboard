import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import WnSop from "@/lib/models/WnSop";
import { cleanSop, serializeSop } from "@/lib/wnSop";

export const dynamic = "force-dynamic";

/** GET /api/wn/sop → every member's SOP, in display order. */
export async function GET() {
  try {
    await connectToDatabase();
    const docs = await WnSop.find().sort({ order: 1, createdAt: 1 }).lean();
    return NextResponse.json({ members: docs.map(serializeSop) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** POST /api/wn/sop → create a member SOP. Body: { name, role, tasks, responsibilities, kpis, notes } */
export async function POST(request: Request) {
  try {
    const input = cleanSop(await request.json());
    if (!input.name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    await connectToDatabase();
    const last: any = await WnSop.findOne().sort({ order: -1 }).lean();
    const doc = await WnSop.create({ ...input, order: (last?.order ?? 0) + 1 });
    return NextResponse.json({ member: serializeSop(doc.toObject()) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
