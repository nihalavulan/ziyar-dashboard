import type { Metadata, Viewport } from "next";
import { connectToDatabase } from "@/lib/mongodb";
import KitchenWorker from "@/lib/models/KitchenWorker";
import KitchenApp from "./KitchenApp";

export const dynamic = "force-dynamic";

async function workerName(token: string) {
  try {
    await connectToDatabase();
    const w: any = await KitchenWorker.findOne({ token }).select("name").lean();
    return w?.name as string | undefined;
  } catch {
    return undefined;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const name = (await workerName(params.token)) ?? "Kitchen Log";
  return {
    title: `${name} · Ziyar Kitchen`,
    manifest: `/k/${params.token}/manifest.webmanifest`,
    robots: { index: false, follow: false },
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
    icons: { icon: "/k/icon/192", apple: "/k/icon/180" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#002422",
};

export default function KitchenPage({ params }: { params: { token: string } }) {
  return <KitchenApp token={params.token} />;
}
