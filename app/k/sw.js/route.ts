/**
 * Service worker for the kitchen app (scope /k/). Always uses the network so data
 * is fresh; when offline it shows a short "no internet" page instead of an error.
 */
const SW = `
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(
    fetch(e.request).catch(
      () =>
        new Response(
          '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:32px;text-align:center;color:#0f172a"><h2>No internet</h2><p>Connect to the internet and open the app again.</p><button onclick="location.reload()" style="padding:12px 20px;border-radius:12px;border:0;background:#002422;color:#fff;font-size:16px">Try again</button></body>',
          { headers: { "Content-Type": "text/html" } }
        )
    )
  );
});
`;

export function GET() {
  return new Response(SW, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/k/",
    },
  });
}
