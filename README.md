# Logictab

Logictab is split into a browser-extension frontend and an AI proxy backend.

```text
logic-lab/
├── frontend/                 # React, TypeScript, Vite, and Chrome extension assets
│   ├── src/
│   ├── public/manifest.json
│   ├── background.js
│   └── .env.example
├── backend/                  # Express API and provider routing
│   ├── index.js
│   └── .env.example
├── package.json              # Shared scripts and dependencies
└── eslint.config.js
```

## Commands

- `npm run dev` — run the Vite frontend.
- `npm run server` — run the Express backend.
- `npm run build` — build the unpacked Chrome extension into `frontend/dist`.
- `npm run validate` — lint, type-check, and build the frontend.

Copy the relevant `.env.example` file before configuring a local frontend or backend environment. For Chrome, load `frontend/dist` as the unpacked extension after a production build.
