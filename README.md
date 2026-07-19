# Logictab

Logictab is a Manifest V3 Chrome Side Panel extension that turns a question into a narrated visual lesson. It generates an explanation timeline, supporting visuals, and—when using **Deep Dive**—a short knowledge check.

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS
- **Extension:** Chrome Manifest V3 Side Panel API
- **Backend:** Node.js, Express, CORS
- **AI providers:** OpenAI, Anthropic Claude, and Google Gemini

## Use the frontend with the live Railway backend

Requires **Node.js 20.19+**.

Clone the repository and install its dependencies:

```bash
git clone <your-github-repository-url>
cd logic-lab
npm install
```

Create `frontend/.env` from `frontend/.env.example`. The repository is preconfigured to use the deployed Railway API; keep or add:

```env
VITE_API_BASE_URL=https://logic-lab-production.up.railway.app
```

Build the Chrome extension:

```bash
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `frontend/dist`.

### Add your AI provider key

Open Logictab from Chrome’s Side Panel, select **Lesson settings**, choose **OpenAI**, **Claude**, or **Gemini**, and paste the corresponding API key. The key is saved only in that browser’s local extension storage and is sent with generation requests to the Railway backend.

You do not need to run the backend locally to use the deployed version. To self-host it instead, copy `backend/.env.example` to `backend/.env`, configure provider keys, and run `npm run server`.

## Useful commands

- `npm run check` — type-check the frontend
- `npm run lint` — lint frontend and backend code
- `npm run validate` — lint, type-check, and build
- `npm run build` — create the production extension in `frontend/dist`
