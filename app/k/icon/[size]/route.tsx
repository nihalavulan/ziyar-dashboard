import { ImageResponse } from "next/og";

/** App icon for the installed kitchen app (sizes 180, 192, 512). */
export async function GET(_req: Request, { params }: { params: { size: string } }) {
  const size = [180, 192, 512].includes(Number(params.size)) ? Number(params.size) : 192;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#002422",
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: size * 0.36, fontWeight: 800, letterSpacing: -size * 0.01 }}>ZM</div>
        <div style={{ fontSize: size * 0.11, fontWeight: 600, color: "#97c4c0", marginTop: size * 0.01 }}>
          KITCHEN
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=604800, immutable" },
    }
  );
}
