# PackRoute — Fulfillment Demo

Demo site for an e-commerce fulfillment business: **pull orders from an API**, then **book shipping from the seller warehouse to the end customer**.

Your cousin can open a link and use the dashboard without installing anything (GitHub Pages). You can run the full version locally with the Python API for live order sync and shipping booking.

## What's included

| File / folder | Purpose |
|---------------|---------|
| `site/index.html` | Dashboard UI |
| `site/css/styles.css` | Styling |
| `site/js/app.js` | Fetches orders, books shipping |
| `site/data/orders.json` | Sample orders (static demo) |
| `api/server.py` | Flask REST API |
| `.github/workflows/pages.yml` | Auto-deploy to GitHub Pages |

## Business flow (demo)

1. **Orders arrive** from a store API (`GET /api/orders`)
2. Operator **marks order ready** when seller has packed it
3. Operator **books shipping** — picks carrier (Israel Post, HFD, FedEx…) from seller → client
4. Order moves to **Shipped** with tracking number

## Option A — GitHub Pages (share a link)

Best for a **read-only / light demo** using static sample data.

1. Create a **private GitHub repo** and push this `ShipBridgeDemo` folder
2. In the repo: **Settings → Pages → Build and deployment**
   - Source: **GitHub Actions**
3. Push to `main` — the workflow deploys `site/` automatically
4. Share the URL: `https://<username>.github.io/<repo-name>/`

> **Note:** Private repos need GitHub Pro/Team/Enterprise for Pages on private repos, OR make the repo public for free Pages.

On Pages, the site loads `data/orders.json`. **Mark ready** works in the browser; **Book shipping** shows a message to run the Python API for full booking.

## Option B — Full demo with Python API (recommended)

```bash
cd ShipBridgeDemo/api
pip install -r requirements.txt
python server.py
```

Open **http://localhost:5000**

API endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/orders` | List all orders |
| GET | `/api/orders/<id>` | Single order |
| POST | `/api/orders/<id>/ready` | Mark ready to ship |
| GET | `/api/shipping-methods` | Available carriers |
| POST | `/api/orders/<id>/ship` | Book shipping |
| POST | `/api/sync` | Pull new orders from simulated store |

## Customization

- **Brand name:** search/replace `PackRoute` in `index.html`
- **Sample orders:** edit `site/data/orders.json`
- **Real store API:** replace `INCOMING_STORE_ORDERS` and `sync_from_store()` in `api/server.py` with your cousin's WooCommerce / Shopify / custom API

## Deploy API online (optional)

GitHub Pages cannot run Python. To host the API for your cousin:

- [Render](https://render.com) — free tier, connect GitHub repo, start command: `python api/server.py`
- [Railway](https://railway.app) — similar setup

Then set in `index.html` before `app.js`:

```html
<script>window.PACKROUTE_API = "https://your-api.onrender.com";</script>
```

## Project structure

```
ShipBridgeDemo/
├── site/           ← GitHub Pages (HTML/CSS/JS)
├── api/            ← Python Flask backend
└── .github/        ← Pages deploy workflow
```
