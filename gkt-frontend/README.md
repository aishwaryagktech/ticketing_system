# GKT Frontend

Next.js 14 (App Router) frontend for the GKT AI-Enabled Ticketing System.

## Quick Start

```bash
npm install
npm run dev
```

Frontend runs at `http://localhost:3000` and communicates with `gkt-backend` at `http://localhost:5000`.

## Architecture

- **App Router** pages for auth, portal, agent, product-admin, and super-admin
- **Axios** for REST API calls to backend
- **Socket.io** for real-time updates
- **Zustand** for client state management
- **Tailwind CSS** for styling
- **Recharts** for analytics charts
- **Tiptap** for rich text editing (KB articles)
