# Deploying Ziyar Majlis to the EC2 (ziyar.flyziyara.com)

This deploys the dashboard on the **same EC2** that runs `wa.flyziyara.com`
(`3.108.74.113`), as a separate site on a new subdomain. It does **not** touch
the existing WhatsApp service — the app runs on its own port (3001) behind its
own nginx server block.

Assumptions (adjust if your server differs): Ubuntu, **nginx** as the web
server, Node 18+ available. If the box uses Caddy/Docker instead of nginx, see
the note at the bottom.

---

## Step 1 — DNS (do this first, in your DNS provider for flyziyara.com)

Add an **A record**:

| Type | Name  | Value          | TTL  |
|------|-------|----------------|------|
| A    | ziyar | 3.108.74.113   | Auto |

> If flyziyara.com is on Cloudflare, set the record to **DNS only** (grey cloud)
> until SSL is issued, then you can proxy it if you want.

Verify it resolves before continuing:

```bash
dig +short ziyar.flyziyara.com   # should return 3.108.74.113
```

---

## Step 2 — SSH in

```bash
chmod 600 ~/Downloads/openwa-key.pem
ssh -i ~/Downloads/openwa-key.pem ubuntu@3.108.74.113
```

(If `ubuntu` fails, try `ec2-user@` or `admin@` — depends on the AMI.)

## Step 3 — Get the code + tooling

```bash
# Node 18+ and pm2 if not already present:
node -v            # expect v18+ ; if missing: sudo apt install -y nodejs npm
sudo npm i -g pm2  # if pm2 isn't installed

cd ~
git clone https://github.com/nihalavulan/ziyar-dashboard.git
cd ziyar-dashboard
```

## Step 4 — Environment secrets

```bash
cp deploy/.env.production.example .env.production
nano .env.production
```

Fill in:
- `MONGODB_URI` – your Atlas string
- `ADMIN_PASSWORD` – the admin password you want
- `JWT_SECRET` – generate one: `openssl rand -hex 32`

## Step 5 — Build + run

```bash
bash deploy/deploy.sh
# then make pm2 restart on reboot (run the command it prints):
pm2 startup
```

The app is now on `127.0.0.1:3001` (not public yet — nginx does that next).

## Step 6 — Nginx site

```bash
sudo cp deploy/ziyar.flyziyara.com.nginx.conf /etc/nginx/sites-available/ziyar.flyziyara.com
sudo ln -s /etc/nginx/sites-available/ziyar.flyziyara.com /etc/nginx/sites-enabled/
sudo nginx -t          # test config
sudo systemctl reload nginx
```

## Step 7 — SSL (HTTPS)

```bash
sudo certbot --nginx -d ziyar.flyziyara.com
# if certbot isn't installed:  sudo apt install -y certbot python3-certbot-nginx
```

Certbot edits the nginx file to add the 443 block and auto-renews.

---

## Done

Open **https://ziyar.flyziyara.com** and log in with `ADMIN_EMAIL` /
`ADMIN_PASSWORD`.

### Redeploying later (after you push changes)

```bash
cd ~/ziyar-dashboard && bash deploy/deploy.sh
```

### If the server uses Caddy instead of nginx

Add this to the Caddyfile and reload Caddy — it handles SSL automatically:

```
ziyar.flyziyara.com {
    reverse_proxy 127.0.0.1:3001
}
```

### If it uses Docker for wa.flyziyara.com

The app still runs fine on the host with PM2 on 3001; just make sure port 3001
is free (`sudo lsof -i :3001`) and, if the reverse proxy is containerised, point
it at the host's 3001.
