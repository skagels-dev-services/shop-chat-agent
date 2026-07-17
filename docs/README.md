# Shopify App Demo

Build/Demo - an eCommerce platform with backend machine learning capabilities, built as a Shopify App (if feasible).

- small eCommerce platform with retailer data import, ETL, and backend machine learning process
- shop UI with customizations, search history, cookies; optimized for speed shopping
- gen ai - on the fly creation based on customer request
- demo shopping experience with agentic sales. AI responds to customer's search and scrolling habits, reacts in real time with customized recommendations / gen-AI 
- show application prompts being generated that will be passed to LLM (via Open AI API, etc.).

**Post-meeting note:** Maybe via a sales chat window?
**Post-meeting note:** Maybe think of this as the agentic store flyer/circular...

- Fashion: customer searches for shirts; agent shows current clothing promos / sales.
- Groceries: customer searches for chicken, agent shows search results + on sale items in the butcher shop and deli ...

Deployment targets under consideration:

- Shopify App Store (primary)
- Google Chrome Extension
- AWS Marketplace

Key product areas:

- Data Load and ETL for backend ML processing
- Agentic sales demo experience with real time AI prompt generation
- Speed optimized shopping with search history and cookie personalization

small eCommerce platform

demo shopping experience agentic sales

---

# Plan created by Claude Code 4/7/2026

## Feasibility

A compelling working demo — custom storefront search + AI-powered recommendations displayed via an injected UI component — is achievable in **5–7 days** of focused work. The Shopify CLI scaffolds most of the plumbing (OAuth, session storage, GraphQL client) in minutes.

---

## Tech Stack (current best practice)

| Layer                | Tool                                                |
| -------------------- | --------------------------------------------------- |
| Scaffolding          | Shopify CLI 3.0+                                    |
| Framework            | React Router (replaced Remix in 2025)               |
| API                  | GraphQL only — REST is deprecated as of April 2025 |
| UI Components        | Polaris (Shopify's design system)                   |
| DB (dev)             | Prisma + SQLite → PostgreSQL for prod              |
| Storefront injection | Theme App Extensions (App Blocks)                   |

---

## Key APIs for this project

- **Storefront API** — product search, real-time recommendations, safe to call client-side
- **Admin API (GraphQL)** — customer data, order history, product enrichment via metafields
- **`productRecommendations` query** — built-in Shopify recommendation engine, returns up to 10 related products
- **Customer Privacy API** — required gatekeeper before any behavioral tracking (cookies, search history)
- **Theme App Extensions / App Blocks** — how you inject the recommendation/chat UI into a merchant's storefront without touching their theme code

---

## Implementation Steps

### Phase 1: Setup (Day 1)

1. Create a free [Shshopify Partner account](https://partners.shopify.com)
2. Create a development store (free, unlimited test orders)
3. Scaffold the app: `npm init @shopify/app@latest` → select React Router template
4. Run locally: `shopify app dev` (auto-creates HTTPS tunnel via Cloudflare)

### Phase 2: Core Features (Days 2–4)

5. Connect Storefront API — implement product search query
6. Add `productRecommendations` query as baseline AI recommendations
7. Build the agentic chat/sales UI component (React) that reads search + scroll behavior
8. Wire in an Anthropic or OpenAI API call to generate real-time contextual prompts based on customer behavior
9. Show the live prompt generation in the UI (this is the demo "wow factor")

### Phase 3: Storefront Integration (Days 5–6)

10. Create a **Theme App Extension** with an App Block — this is how the recommendation panel gets injected into the storefront without modifying the merchant's theme
11. Merchant adds the App Block to product/collection pages via Shopify theme editor (no code)

### Phase 4: Admin Dashboard (Day 7)

12. Build a simple admin page (Polaris UI) showing recommendations activity and allowing configuration

---

## Key Constraints

- **Can't replace native Shopify search** — you build a parallel/overlay UI, not intercept the built-in search
- **Cookies/tracking require consent** — must use Customer Privacy API before logging behavior
- **Can't run arbitrary JS on storefront** — must use App Blocks (which is fine for the demo use case)
- **Checkout modifications** are a separate extension type with more restrictions

---

## Scope Recommendation for Demo

For a compelling first demo, scope it to:

1. App Block that renders an **"Agentic Sales Assistant"** chat/overlay panel on product/collection pages
2. Panel reads the customer's current search term + product being viewed
3. Calls OpenAI (or Claude) in real-time to generate a sales recommendation prompt
4. Shows both the **generated prompt** and the **AI response** (the "show your work" demo moment)
5. Pulls related products via `productRecommendations` to display alongside

This hits all the demo goals: agentic sales, real-time prompt generation, visible AI reasoning, and product recommendations — without needing real ML or behavioral data collection to be impressive.

---

## Shopify  - Build Storefront AI Agent

[https://shopify.dev/docs/apps/build/storefront-mcp/build-storefront-ai-agent?framework=reactRouter](https://shopify.dev/docs/apps/build/storefront-mcp/build-storefront-ai-agent?framework=reactRouter)

## Shopify - shop-chat-agent

See subdir `./shop-chat-agent`
