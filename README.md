# PriceSpy — Product Price Comparison (SerpAPI Edition)

Compare Amazon.in & Flipkart prices, read Reddit & YouTube reviews, all in one search.

## Quick Start

### 1. Get a SerpAPI key
Sign up free at https://serpapi.com — you get 100 free searches/month.

### 2. Install & Configure
```bash
cd pricespy-serpapi
npm install

# Copy the env file and add your key
cp .env.example .env
# Edit .env and replace 'your_serpapi_key_here' with your real key
```

### 3. Run
```bash
node server.js
# or for auto-reload during development:
npx nodemon server.js
```

### 4. Open in browser
Visit **http://localhost:3001**

---

## How it works

```
Browser (index.html)
    │
    │  fetch /api/search?q=...
    │
    ▼
Node.js Express Server (server.js)
    │
    ├── SerpAPI Google Shopping (Amazon.in)
    ├── SerpAPI Google Shopping (Flipkart)
    ├── SerpAPI Google (Reddit discussions)
    └── SerpAPI YouTube search
    │
    ▼
Returns JSON → Frontend renders results
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/search?q=product+name` | Main search — prices, Reddit, YouTube |
| `GET /api/pros-cons?q=product` | Fetch review snippets for pros/cons |
| `GET /api/health` | Health check |

## SerpAPI Engines Used

- `google_shopping` — Price data for Amazon.in and Flipkart
- `google` — Reddit discussions scoped to reddit.com
- `youtube` — YouTube review videos

## Folder Structure

```
pricespy-serpapi/
├── server.js         # Express backend
├── package.json
├── .env.example      # Copy to .env and add key
└── public/
    └── index.html    # Frontend (served by Express)
```

## Notes

- SerpAPI free tier: 100 searches/month. Each product search uses ~3-4 credits.
- Pros/cons are extracted from review snippets using keyword matching.
- For production use, add rate limiting and caching (Redis/memory).
