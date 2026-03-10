# GKT Backend

Express.js + Node.js backend for the GKT AI-Enabled Ticketing System.

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migration
npx prisma migrate dev

# Seed the database
npm run prisma:seed

# Start development server
npm run dev
```

## Environment

Copy `.env` and update values for your environment. See `project-setup.md` for full variable reference.

## Architecture

- **Routes** → Controllers → Services → DB
- **PostgreSQL** (Prisma) — relational data (products, users, tickets, SLA, etc.)
- **MongoDB** (Mongoose) — conversations, AI logs, analytics events
- **Qdrant** — vector embeddings for KB search, duplicate detection, resolution suggestions
- **Socket.io** — real-time ticket updates, SLA warnings, notifications
- **Cron** — SLA deadline checks & escalation rule evaluation (every 5 min)
