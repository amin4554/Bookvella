# Bookvella — VPS Deployment Guide (Jenkins + Docker Compose)

> Replace every occurrence of `bookvella.com` with your actual domain (e.g. `bookvella.com`)  
> Replace `YOUR_VPS_IP` with your server's public IP address

---

## Overview

```
Internet → Nginx (80/443) → web:3001 (Next.js)
                          → api:3000  (NestJS)
Jenkins (port 8080) runs inside the same compose stack
and deploys by rebuilding images and restarting containers.
```

---

## Phase 1 — Set up your VPS

### 1.1 SSH into your server

```bash
ssh root@YOUR_VPS_IP
```

### 1.2 Install Docker Engine + Compose plugin

```bash
apt-get update && apt-get install -y ca-certificates curl gnupg

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose version
```

### 1.3 Open firewall ports

```bash
ufw allow 22      # SSH
ufw allow 80      # HTTP (nginx + certbot ACME)
ufw allow 443     # HTTPS
ufw allow 8080    # Jenkins UI
ufw enable
```

---

## Phase 2 — Point your DNS records

In your domain registrar / DNS provider add **two A records**:

| Type | Name           | Value         |
|------|----------------|---------------|
| A    | `bookvella.com`  | `YOUR_VPS_IP` |
| A    | `api.bookvella.com` | `YOUR_VPS_IP` |

Wait for DNS to propagate (usually a few minutes). Verify with:
```bash
ping bookvella.com
ping api.bookvella.com
```

---

## Phase 3 — Push your code to GitHub

On your local machine:

```bash
cd /path/to/Bookvella
git add .
git commit -m "feat: add production deployment config"
git push origin main
```

---

## Phase 4 — Clone the repo on the VPS

```bash
# Pick a home for the project
mkdir -p /opt/bookvella
cd /opt/bookvella

git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO.git .
```

---

## Phase 5 — Create .env.production on the VPS

**Never commit this file.** Create it directly on the server:

```bash
cp .env.production.example .env.production
nano .env.production
```

Fill in every value. Key things to generate:

```bash
# Generate a strong JWT key pair
openssl genrsa -out jwt_private.pem 2048
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem

# Print each as a single escaped line for the env file
# (replace actual newlines with \n so it fits on one line)
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' jwt_private.pem
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' jwt_public.pem

# Generate random secrets
openssl rand -hex 32   # use once for EMAIL_CODE_SECRET
openssl rand -hex 32   # use once for REVIEW_TOKEN_SECRET
```

Make sure `WEB_DOMAIN` and `API_DOMAIN` match your actual domain:
```
WEB_DOMAIN=bookvella.com
API_DOMAIN=api.bookvella.com
NEXT_PUBLIC_API_URL=https://api.bookvella.com
NEXT_PUBLIC_APP_URL=https://bookvella.com
```

---

## Phase 6 — Replace bookvella.com in the nginx config

**On your local machine**, open `deploy/nginx/conf.d/bookvella.conf`  
and do a find-and-replace:

- `bookvella.com` → your actual domain (e.g. `bookvella.com`)

Then commit and push:
```bash
git add deploy/nginx/conf.d/bookvella.conf
git commit -m "chore: set domain in nginx config"
git push origin main
```

Then on the VPS pull the change:
```bash
cd /opt/bookvella
git pull
```

---

## Phase 7 — Bootstrap SSL (first time only)

SSL setup has a chicken-and-egg problem: nginx needs the cert to start,
but certbot needs nginx running. We solve it in two steps.

### 7.1 Start only nginx in HTTP-only mode temporarily

Comment out the HTTPS server blocks in the nginx config temporarily,
or use the simpler approach: start nginx first, get the cert, then restart.

**Step A** — Start just postgres + nginx (no SSL blocks will fail yet because
nginx will serve HTTP for the ACME challenge):

```bash
cd /opt/bookvella

# Start postgres and nginx first (nginx serves port 80 only initially)
docker compose -f docker-compose.prod.yml up -d postgres nginx
```

> If nginx fails because it can't find the cert files yet, temporarily
> comment out the `listen 443 ssl` blocks in `bookvella.conf`, restart nginx,
> get the cert, then uncomment.

**Step B** — Issue the certificate:

```bash
docker compose -f docker-compose.prod.yml run --rm certbot \
  certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d bookvella.com \
    -d www.bookvella.com \
    --email a.n.ardekani2003@gmail.com \
    --agree-tos \
    --no-eff-email

# Do the same for the API subdomain
docker compose -f docker-compose.prod.yml run --rm certbot \
  certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d api.bookvella.com \
    --email a.n.ardekani2003@gmail.com \
    --agree-tos \
    --no-eff-email
```

**Step C** — If you commented out HTTPS blocks, uncomment them now and restart nginx:

```bash
docker compose -f docker-compose.prod.yml restart nginx
```

---

## Phase 8 — First full deployment

```bash
cd /opt/bookvella

# Build everything and start the full stack
docker compose -f docker-compose.prod.yml up -d --build

# Watch the logs
docker compose -f docker-compose.prod.yml logs -f
```

Check all containers are healthy:
```bash
docker compose -f docker-compose.prod.yml ps
```

You should see `healthy` next to `postgres` and `api`.

Run the initial DB migration:
```bash
docker compose -f docker-compose.prod.yml exec api \
  sh -c "npx prisma migrate deploy"
```

Test that your site is reachable:
- `https://bookvella.com` → Next.js web app
- `https://api.bookvella.com/health/live` → should return 200

---

## Phase 9 — Configure Jenkins

### 9.1 Get the initial admin password

```bash
docker compose -f docker-compose.prod.yml exec jenkins \
  cat /var/jenkins_home/secrets/initialAdminPassword
```

Copy the password.

### 9.2 Open Jenkins in your browser

Go to `http://YOUR_VPS_IP:8080`

1. Paste the initial admin password
2. Click **Install suggested plugins** (wait ~2 min)
3. Create your admin user (use the credentials from `.env.production`: `JENKINS_ADMIN_ID` / `JENKINS_ADMIN_PASSWORD`)
4. Set Jenkins URL to `http://YOUR_VPS_IP:8080` → Save and finish

### 9.3 Add your GitHub credentials to Jenkins

1. Go to **Manage Jenkins → Credentials → System → Global credentials → Add Credentials**
2. Kind: **Username with password**
   - Username: your GitHub username
   - Password: a GitHub **Personal Access Token** (PAT) with `repo` scope
   - ID: `github-credentials`
   - Description: `GitHub PAT`
3. Click **Create**

### 9.4 Create the Pipeline job

1. **New Item** → name it `bookvella` → select **Pipeline** → OK
2. Under **Build Triggers**, check **GitHub hook trigger for GITScm polling**
3. Under **Pipeline**, select **Pipeline script from SCM**:
   - SCM: **Git**
   - Repository URL: `https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO.git`
   - Credentials: select `github-credentials`
   - Branch: `*/main`
   - Script Path: `Jenkinsfile`
4. Click **Save**

### 9.5 Add a GitHub Webhook (auto-trigger on push)

In your GitHub repo → **Settings → Webhooks → Add webhook**:
- Payload URL: `http://YOUR_VPS_IP:8080/github-webhook/`
- Content type: `application/json`
- Events: **Just the push event**
- Active: ✅

### 9.6 Run your first manual build

In Jenkins, open the `bookvella` job and click **Build Now**.  
Watch the **Console Output** — it should go through all stages and end with ✅.

---

## Phase 10 — Ongoing workflow

From now on, every time you push to `main`:

1. GitHub sends a webhook to Jenkins
2. Jenkins checks out the triggering commit
3. Jenkins copies the server-only `.env.production` into that checked-out workspace
4. Builds new Docker images for `api` and `web`
5. Runs the API build and unit tests during the API image build
6. Runs Prisma migrations when the new API container starts
7. Replaces the running containers with zero-downtime (`--no-deps`)
8. Health-checks the API
9. Cleans up old images

Uploaded host/profile/service images are stored in the `api_uploads` Docker volume. Do not prune named volumes during normal cleanup.

---

## Useful commands (on the VPS)

```bash
# View live logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web

# Restart a single service
docker compose -f docker-compose.prod.yml restart api

# Shell into the API container
docker compose -f docker-compose.prod.yml exec api sh

# Run a migration manually
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# Pull latest and redeploy manually (without Jenkins)
git pull && docker compose -f docker-compose.prod.yml up -d --build api web

# Check disk usage
docker system df
docker image prune -f
```

## Rollback

If a deployment fails after images were rebuilt, first inspect the failed service logs:

```bash
cd /opt/bookvella
docker compose -p bookvella -f docker-compose.prod.yml logs --tail=100 api
docker compose -p bookvella -f docker-compose.prod.yml logs --tail=100 web
```

To roll back to a previous Git commit, check out the known-good commit and rebuild the app services:

```bash
cd /opt/bookvella
git fetch origin
git checkout <known-good-commit-sha>
docker compose -p bookvella -f docker-compose.prod.yml up -d --build --no-deps api web
docker compose -p bookvella -f docker-compose.prod.yml ps
```

Only roll database migrations forward. If a failed release included a schema migration, prefer shipping a corrective migration instead of manually editing or reverting the production database.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| nginx exits immediately | HTTPS cert files don't exist yet → do Phase 7 first |
| API container unhealthy | Check `docker logs bookvella-api-1`; usually a bad `DATABASE_URL` or missing env var |
| Jenkins can't run docker | Make sure `/var/run/docker.sock` is mounted and Jenkins image built from `deploy/jenkins/Dockerfile` |
| Certbot says "no valid A record" | DNS hasn't propagated yet — wait and retry |
| Next.js shows wrong API URL | `NEXT_PUBLIC_API_URL` is a build-time arg — rebuild the `web` image after changing it |
