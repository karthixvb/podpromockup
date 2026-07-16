# POD Pro Webapp

Multi-store Print-on-Demand admin built with **Next.js 15**, Prisma, and Shopify OAuth. Connect multiple Shopify shops under one email login, manage templates/sets/pricing/batches, compose mockups via AWS Lambda + S3, and sync products through the Admin API. Storefront UX is a Theme App Extension (`extensions/pod-product-page`).

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind
- Prisma (SQLite locally; set `DATABASE_URL` to Postgres in production)
- Email/password auth (`bcryptjs` + `iron-session`)
- Shopify Offline OAuth (`@shopify/shopify-api`)
- Compose: `AWS_LAMBDA_COMPOSITE_URL` · Storage: S3

## Setup

### 1. Install

```bash
cd pod-pro-webapp
npm install
cp .env.example .env
```

### 2. Environment

Edit `.env`:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | `file:./dev.sqlite` (local) or Postgres URL |
| `HOST` | Public app URL, e.g. `http://localhost:3000` or `https://your.app` |
| `SESSION_SECRET` | ≥32 random characters |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | Partner app credentials |
| `SCOPES` | `write_products,read_products,write_files,read_files` |
| `AWS_LAMBDA_COMPOSITE_URL` | Sharp compose Lambda URL |
| `AWS_S3_*` | Bucket, region, keys, optional `AWS_S3_PUBLIC_BASE_URL` |
| `POD_COMPOSE_CONCURRENCY` | Default `6` |
| `POD_SYNC_CONCURRENCY` | Default `5` |

### 3. Database

```bash
npx prisma db push
npx prisma generate
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → register → **Stores** → connect a shop.

For Shopify OAuth on localhost, use a tunnel (Cloudflare Tunnel / ngrok) and set `HOST` to that HTTPS URL. Add the callback to the Partner app:

`https://YOUR_HOST/api/shopify/auth/callback`

## Multi-store workflow

1. Create an account (email/password).
2. **Stores** → enter `your-shop.myshopify.com` → Install / OAuth.
3. Repeat for Shop B, Shop C…
4. Use the sidebar **shop switcher** (or Stores page) to change the active shop. All templates, sets, batches, and settings are scoped to the active shop.
5. Workflow per shop: Templates (crop) → Template set → Pricing (optional) → Settings → New batch (JSON) → Sync products.

Re-sync updates existing products for the same design SKU + product type (no duplicate `-1` handles).

## Shopify Partner app + theme extension

You still need **one Public** Shopify Partner app (OAuth + theme extension). Merchants install via OAuth from this webapp (and later App Store if listed)—not Custom distribution per shop.

1. Create/update the app in [Partner Dashboard](https://partners.shopify.com/).
2. Set `shopify.app.toml`: `client_id`, `application_url`, auth redirect URLs, webhook URIs (`/api/shopify/webhooks/...`).
3. Deploy the theme extension:

```bash
npm i -g @shopify/cli
shopify app deploy
```

4. In each store’s theme editor, add the **POD Product Experience** block on the product template.
5. Hide the theme’s Color variant pills (keep Size); POD swatches handle color.

Metafields are written to the app namespace and mirrored to `pod.*` for Liquid.

## Go-live checklist

- [ ] `HOST` + Shopify credentials + Lambda + S3 configured
- [ ] Postgres `DATABASE_URL` (recommended for production)
- [ ] Strong `SESSION_SECRET`
- [ ] Theme extension deployed; block added; Color picker hidden
- [ ] Connect production shops via OAuth
- [ ] Create templates with crop regions and mockup images
- [ ] Create a template set spanning garment types
- [ ] Run a small batch → verify products, images, metafields, storefront UX
- [ ] Google & YouTube channel installed if using Shopping feed fields

## Scripts

```bash
npm run dev      # development
npm run build    # production build
npm run start    # serve production build
npx prisma studio
```

## Project layout

```
src/app/(app)/     # Authenticated admin (dashboard, templates, batches, …)
src/app/api/       # Auth, Shopify OAuth/webhooks, CRUD APIs
src/lib/           # pod, storage, composite, batch-worker, shopify-products
extensions/        # Theme App Extension (pod-product-page)
prisma/            # Schema
shopify.app.toml   # Partner app + metafields + webhooks
```

## Out of scope (v1)

- Billing / subscriptions
- Embedded Shopify Admin UI
- Automatic migration from the old embedded app SQLite DB
