import { cookies } from "next/headers";
import { verifyWnToken, WN_COOKIE } from "@/lib/auth";
import WnShell from "./WnShell";

export default async function WnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const wn = await verifyWnToken(cookies().get(WN_COOKIE)?.value);
  return <WnShell username={wn?.username ?? ""}>{children}</WnShell>;
}
