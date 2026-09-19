// PM2 process config for the Ziyar Majlis dashboard.
// Runs the Next.js production server on port 3001 (wa.flyziyara.com keeps its
// own port). Adjust `cwd` if you clone the repo somewhere else.
module.exports = {
  apps: [
    {
      name: "ziyarmajlis",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3001",
      cwd: "/home/ubuntu/ziyar-dashboard",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "400M",
    },
  ],
};
