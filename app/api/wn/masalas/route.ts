import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import WnMasala from "@/lib/models/WnMasala";
import { cleanMasalaBody, serializeMasala } from "@/lib/masala";

export const dynamic = "force-dynamic";

/** GET /api/wn/masalas → all masala recipes. */
export async function GET() {
  try {
    await connectToDatabase();
    const docs = await WnMasala.find().sort({ order: 1, createdAt: 1 }).lean();
    return NextResponse.json({ masalas: docs.map(serializeMasala) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** POST /api/wn/masalas  Body: { name, rows?, yieldQty?, yieldUnit? } */
export async function POST(request: Request) {
  try {
    const data = cleanMasalaBody(await request.json());
    if (!data.name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    await connectToDatabase();
    const last: any = await WnMasala.findOne().sort({ order: -1 }).lean();
    const doc = await WnMasala.create({ ...data, order: (last?.order ?? 0) + 1 });
    return NextResponse.json({ masala: serializeMasala(doc) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
