# Kindred — Find Your Tribe

> AI-powered personality matching that automatically places you in a private group of up to 30 like-minded people.

![Kindred](https://img.shields.io/badge/node-20-brightgreen) ![PostgreSQL](https://img.shields.io/badge/postgres-15-blue) ![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [How Matching Works](#how-matching-works)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [Deploying to DigitalOcean](#deploying-to-digitalocean)
- [GitHub Actions CI/CD](#github-actions-cicd)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)

---

## Overview

Kindred lets users take an 18-question personality quiz and get automatically assigned to a **Tribe** — a private group of ≤30 people with similar personalities, values, and interests. Tribes have:

- **Group chat** with real-time message polling
- **Member directory** showing shared interests
- **About page** with tribe stats and matching explanation

New tribes are automatically seeded when an existing one fills up.

---

## Tech Stack

| Layer        | Technology                              |
|--------------|-----------------------------------------|
| Frontend     | React 18, Vite, Tailwind CSS v3, shadcn/ui |
| Backend      | Node.js 20, Express 5, TypeScript       |
| Database     | PostgreSQL 15 + Drizzle ORM             |
| Auth         | Server-side sessions (connect-pg-simple) |
| Security     | Helmet, CORS, express-rate-limit        |
| Process mgr  | PM2 (cluster mode)                      |
| Web server   | Nginx (reverse proxy + static assets)   |
| SSL          | Let's Encrypt via Certbot               |

---

## How Matching Works

1. **Feature vector**: Each user's 18 quiz answers are converted into a ~35-dimensional numeric vector covering personality traits (Big Five dimensions), values, lifestyle, interests, and group dynamics preferences.

2. **Cosine similarity**: The user's vector is compared against each existing tribe's centroid vector. A score ≥ 0.70 qualifies as a match.

3. **Assignment**: The highest-scoring tribe with open capacity is selected. If no tribe qualifies, a new one is automatically created and named.

4. **Centroid update**: After every assignment the tribe centroid is recomputed from all member vectors so future matches sharpen over time.

---

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ running locally
- `npm` or `pnpm`

### Steps

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/kindred.git
cd kindred

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your local DATABASE_URL and SESSION_SECRET

# 4. Run migrations
npx tsx scripts/migrate.ts

# 5. Start dev server (hot reload)
npm run dev
```

Open http://localhost:5000

---

## Environment Variables

| Variable          | Required | Description                                              |
|-------------------|----------|----------------------------------------------------------|
| `DATABASE_URL`    | ✅        | PostgreSQL connection string                             |
| `SESSION_SECRET`  | ✅        | Random 64-char hex string for session signing            |
| `NODE_ENV`        | ✅        | `development` or `production`                            |
| `PORT`            | ❌        | HTTP port (default: `5000`)                              |
| `ALLOWED_ORIGINS` | ❌        | Comma-separated allowed CORS origins (default: localhost) |
| `RATE_LIMIT_MAX`  | ❌        | Max API requests per IP per 15 min (default: `300`)      |
| `DATABASE_SSL`    | ❌        | Set to `true` to enable SSL for DB connection            |

Generate a session secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Database Migrations

Migrations live in `/migrations/` as numbered `.sql` files and are applied in order by the runner.

```bash
# Run all pending migrations
npx tsx scripts/migrate.ts

# Generate new migration (after editing shared/schema.ts)
npx drizzle-kit generate
```

---

## Deploying to DigitalOcean

### Option A — Automated script (recommended for first deploy)

1. Spin up a DigitalOcean Droplet: **Ubuntu 22.04 LTS**, min 1 GB RAM / 1 vCPU / 25 GB SSD.

2. Point your domain's A record to the droplet IP and wait for DNS to propagate.

3. SSH into the droplet as root:
   ```bash
   ssh root@YOUR_DROPLET_IP
   ```

4. Upload and run the deploy script:
   ```bash
   # From your local machine
   scp scripts/deploy-digitalocean.sh root@YOUR_DROPLET_IP:~/
   
   # On the droplet
   # Edit DOMAIN and REPO_URL at the top of the script first
   nano deploy-digitalocean.sh
   chmod +x deploy-digitalocean.sh
   bash deploy-digitalocean.sh
   ```

The script will:
- Install Node 20, PostgreSQL 15, Nginx, PM2, Certbot
- Create a `kindred` system user and `/var/www/kindred` directory
- Clone your repo, generate a `.env`, run migrations, build, and start with PM2
- Configure Nginx as a reverse proxy with gzip and long-cache headers for assets
- Obtain a Let's Encrypt SSL certificate (if DNS has propagated)

### Option B — Manual updates after first deploy

```bash
# On the droplet
sudo -u kindred bash /var/www/kindred/scripts/update.sh
```

### Useful PM2 commands (on the droplet)

```bash
sudo -u kindred pm2 status               # view process status
sudo -u kindred pm2 logs kindred         # tail logs
sudo -u kindred pm2 reload kindred       # zero-downtime reload
sudo -u kindred pm2 restart kindred      # hard restart
```

### Nginx commands

```bash
nginx -t                                 # test config
systemctl reload nginx                   # apply config changes
```

---

## GitHub Actions CI/CD

Automated CI/CD is configured in `.github/workflows/`.

### Secrets to configure in GitHub

Go to **Settings → Secrets and variables → Actions** and add:

| Secret            | Value                                          |
|-------------------|------------------------------------------------|
| `DROPLET_HOST`    | Your droplet IP or domain                      |
| `DROPLET_USER`    | `kindred` (the app user created by the script) |
| `DROPLET_SSH_KEY` | Contents of `~/.ssh/id_ed25519` (private key)  |
| `DROPLET_PORT`    | `22` (or your custom SSH port)                 |

### Setting up SSH key authentication

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-kindred" -f ~/.ssh/kindred_deploy

# Copy public key to the droplet
ssh-copy-id -i ~/.ssh/kindred_deploy.pub kindred@YOUR_DROPLET_IP

# Add private key content to GitHub secret DROPLET_SSH_KEY
cat ~/.ssh/kindred_deploy
```

### Workflow behaviour

| Event              | Action                                          |
|--------------------|------------------------------------------------|
| Push to `main`     | Build → type check → SSH deploy via `update.sh` |
| PR to `main`       | Build + type check only (no deploy)            |
| Push to `develop`  | Build + type check only                        |

---

## Project Structure

```
kindred/
├── client/
│   └── src/
│       ├── App.tsx               # Router shell
│       ├── components/
│       │   ├── theme-provider.tsx
│       │   ├── user-context.tsx
│       │   └── ui/               # shadcn/ui components
│       └── pages/
│           ├── landing.tsx       # Home + auth forms
│           ├── quiz.tsx          # 18-question onboarding quiz
│           ├── tribe-dashboard.tsx  # Chat, members, about
│           └── admin.tsx         # Admin tribe overview
├── server/
│   ├── index.ts                  # Express app + middleware
│   ├── db.ts                     # PostgreSQL pool + Drizzle
│   ├── storage.ts                # DB query layer (IStorage interface)
│   ├── matching.ts               # Cosine similarity matching algorithm
│   ├── routes.ts                 # API route handlers
│   └── vite.ts                   # Dev server integration
├── shared/
│   └── schema.ts                 # Drizzle schema + Zod types + quiz questions
├── migrations/
│   └── 0001_initial.sql          # Database schema SQL
├── scripts/
│   ├── migrate.ts                # Migration runner
│   ├── deploy-digitalocean.sh    # First-deploy automation
│   └── update.sh                 # Zero-downtime update script
├── .github/
│   └── workflows/
│       ├── deploy.yml            # Deploy to DO on push to main
│       └── ci.yml                # Type check on PRs
├── ecosystem.config.cjs          # PM2 cluster config
├── .env.example                  # Environment variable template
├── drizzle.config.ts             # Drizzle ORM config
└── README.md
```

---

## API Reference

### Auth
| Method | Endpoint       | Body                  | Description          |
|--------|---------------|-----------------------|----------------------|
| POST   | /api/register  | `{name, email}`       | Register user        |
| POST   | /api/login     | `{email}`             | Login by email       |
| POST   | /api/logout    | —                     | Destroy session      |
| GET    | /api/me        | —                     | Current session user |

### Quiz
| Method | Endpoint              | Description               |
|--------|-----------------------|---------------------------|
| GET    | /api/quiz/questions   | All 18 quiz questions     |
| POST   | /api/quiz/submit      | Submit answers + get tribe |

### Tribes
| Method | Endpoint                  | Description              |
|--------|--------------------------|--------------------------|
| GET    | /api/tribes               | All tribes               |
| GET    | /api/tribe/:id            | Single tribe             |
| GET    | /api/tribe/:id/members    | Tribe members            |
| GET    | /api/tribe/:id/messages   | Last 200 messages        |
| POST   | /api/tribe/:id/messages   | Send a message           |

### Admin
| Method | Endpoint             | Description                    |
|--------|---------------------|--------------------------------|
| GET    | /api/admin/stats    | Platform-wide stats            |
| GET    | /api/admin/tribes   | All tribes with member lists   |

### Utility
| Method | Endpoint      | Description    |
|--------|-------------|----------------|
| GET    | /api/health   | Server health  |

---

## License

MIT — see [LICENSE](LICENSE)
