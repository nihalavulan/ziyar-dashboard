import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import KitchenWorker from "@/lib/models/KitchenWorker";

export const dynamic = "force-dynamic";

/** Per-person install manifest: the installed app always opens their own page. */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  let name = "Kitchen Log";
  try {
    await connectToDatabase();
    const w: any = await KitchenWorker.findOne({ token: params.token }).select("name").lean();
    if (w?.name) name = w.name;
  } catch {
    // fall back to the generic name
  }
  const start = `/k/${params.token}`;
  return new NextResponse(
    JSON.stringify({
      id: start,
      name: `${name} · Ziyar Kitchen`,
      short_name: name.length > 12 ? "Ziyar Kitchen" : name,
      description: "Daily kitchen usage log for Ziyar Majlis.",
      start_url: start,
      scope: start,
      display: "standalone",
      orientation: "portrait",
      background_color: "#f8fafc",
      theme_color: "#002422",
      icons: [
        { src: "/k/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/k/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/k/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    }),
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "no-store",
      },
    }
  );
}
