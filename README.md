# Apaar Garage

Apaar Garage is a storefront for diecast collectibles and RC toys. The Angular client talks to an Express API backed by MongoDB.

## Set up and run

Use Node.js 24 with npm, and a MongoDB replica set or Atlas cluster. Checkout, cancellation, guest-cart merging, and reviews use MongoDB transactions.

From the project root in PowerShell, install the server dependencies and create a local environment file if one is absent.

```powershell
Set-Location server
npm.cmd ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Set `MONGODB_URI` to your development database and replace the sample `JWT_SECRET` with a random secret of at least 32 bytes. Generate one with `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep `server/.env` private.

From `server`, load the sample catalog and start the API.

```powershell
npm.cmd run seed
npm.cmd start
```

The seed script adds missing products by slug. It preserves existing inventory and price records. The RC listings are marked as samples. The API binds to `127.0.0.1:3000` by default.

In another PowerShell window at the project root, start Angular.

```powershell
Set-Location client
npm.cmd ci
npm.cmd start
```

Open [the storefront](http://localhost:4200). The Angular development proxy forwards `/products` and `/api/**` to the Express server. If you change the API port, update the targets in `client/src/proxy.conf.json` to match.

## Environment variables

`server/.env.example` contains development defaults and placeholders. Monetary environment settings are in rupees unless the field name ends with `Paise`.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Set to `production` to enable secure session cookies and HSTS. |
| `MONGODB_URI` | Development or deployment database URI. |
| `PORT` | API port. Defaults to `3000`. |
| `JWT_SECRET` | Random secret of at least 32 bytes. |
| `CORS_ORIGINS` | Comma-separated HTTP(S) origins without trailing slashes. |
| `PAYMENT_ONLINE_ENABLED` | Defaults to `false`. Online payment currently returns an unavailable response when enabled. |
| `COD_FEE` | Cash on Delivery charge. Defaults to zero. |
| `COD_MIN_ORDER_VALUE`, `COD_MAX_ORDER_VALUE` | Merchandise subtotal limits before fees and discounts. The maximum is unlimited when blank. |
| `DELIVERY_FEE`, `FREE_DELIVERY_MIN_ORDER_VALUE` | Flat delivery charge and optional free-delivery threshold. |
| `ORDER_DELIVERY_ESTIMATE`, `DELIVERY_PINCODE_RULES` | Default delivery estimate and optional JSON prefix rules such as `[{"prefix":"411","estimate":"2–3 business days","cod":true}]`. |
| `FIRST_ORDER_DISCOUNT_PERCENT`, `COUPONS_JSON` | First-order percentage and the JSON array of coupon rules. See the environment example for a coupon. |
| `ORDER_EMAIL_ENABLED`, `ORDER_EMAIL_FROM` | Enable order email and set your verified sender address. |
| `ORDER_SMTP_HOST`, `ORDER_SMTP_PORT`, `ORDER_SMTP_USER`, `ORDER_SMTP_PASSWORD` | SMTP connection and credentials. Email defaults to off. |

## Checks

Run these from `client`.

```powershell
npm.cmd test -- --watch=false
npm.cmd run build
```

If Angular's optional Windows native chunk optimizer fails to load, retry the production build in the same shell with `$env:NG_BUILD_OPTIMIZE_CHUNKS = 'false'`. The TypeScript and Angular template checks still run.

Run `npm.cmd run lint`, `npm.cmd run format:check`, and `npm.cmd test` from `server`. The server tests start an isolated MongoDB replica set and never use `server/.env`. The first test run may download a MongoDB binary. Set `MONGOMS_SYSTEM_BINARY` to use an existing compatible binary.

## Generate SEO files for deployment

Start the API against the catalog you plan to publish. Then run these commands from `client` with your public storefront origin. The generator only reads the paginated public product endpoint.

```powershell
$env:SITE_URL = 'https://shop.example'
$env:SEO_CATALOG_API = 'http://127.0.0.1:3000'
npm.cmd run build:seo
```

Deploy `client/dist/apaar-garage/browser` and serve generated route files before the Angular fallback. The build writes `sitemap.xml`, links it in `robots.txt`, and adds metadata for sharing without JavaScript. For category-specific sharing previews, internally rewrite `/catalog?category=<id>` to `/_seo/category/<id>/index.html`. Use the equivalent `/_seo/productType/<id>/index.html` for type-only links. Keep the public URL unchanged and never overwrite the site's fallback with a category page. Rebuild after published products, prices, or stock change so the pre-generated metadata stays current.

## Preview and audit a production build

With the local API running, use a separate terminal in `client` and stop any dev server using port 4200.

```powershell
npm.cmd run build
npm.cmd run preview
```

The loopback preview at `http://127.0.0.1:4200` serves the built files with gzip and forwards `/products` and `/api` requests to the local API. Set `PREVIEW_PORT` or `PREVIEW_API` to use another port or API origin. For sign-in and cart writes, include the preview origin in the API's `CORS_ORIGINS`. Audit the home page, `/catalog`, and an existing product URL with Lighthouse in mobile mode. Use a fresh session to include the first-visit garage intro, and keep the same catalog data and throttling when comparing builds. Production hosts should enable Brotli or gzip for scripts, styles, and HTML.

## Folder structure

- `client/src/app` groups storefront pages into folders such as `home`, `catalog`, `product-detail`, `cart`, and `orders`.
- `client/src/app/ui`, `motion`, and `car-viewer` contain the shared UI, animations, and product viewer.
- `server/src/routes` connects HTTP endpoints to `controllers`. Controllers validate requests and shape responses.
- `server/src/services` holds business rules and database workflows. `models` defines stored documents, `middleware` handles HTTP concerns, and `utils` holds configuration and helpers.
- `server/scripts` contains sample products and seeding. `server/test` contains the HTTP regression suite.

See [Architecture](docs/ARCHITECTURE.md) and [Change guide](docs/CHANGE-GUIDE.md).
