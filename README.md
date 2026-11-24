# Apaar Garage

Apaar Garage is a storefront for diecast collectibles and RC toys. The Angular client talks to an Express API backed by MongoDB.

## Set up and run

Use Node.js 24 with npm, and a MongoDB replica set or Atlas cluster. Checkout, inventory changes, returns, invoices, guest-cart merging, and reviews use MongoDB transactions.

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

The seed adds 12 diecast and 15 RC sample listings, preserves existing prices and stock, and upgrades known legacy sample listings with demo compliance fields. All samples are placeholders and stay out of the storefront when `NODE_ENV=production`. Existing real listings without a publication status must be reviewed and published through the admin API. The API binds to `127.0.0.1:3000` by default.

In another PowerShell window at the project root, start Angular.

```powershell
Set-Location client
npm.cmd ci
npm.cmd start
```

Open [the storefront](http://localhost:4200). The Angular development proxy forwards `/products` and `/api/**` to the Express server. If you change the API port, update the targets in `client/src/proxy.conf.json` to match.

## Set up administrator access

Run the following in an interactive terminal from `server`.

```powershell
npm.cmd run create-admin
```

Enter the administrator email and the new password twice. If the email is already registered, the command promotes the account and requires a fresh sign-in. On macOS or Linux, use `npm run create-admin`.

Open `/admin/login` after creating the account. Production requires authenticator enrollment. Save your one-time recovery codes. Use `npm.cmd run remove-admin` from `server` to revoke administrator access.

In production, the API refuses to start until the seller legal name and address, customer care phone and email, grievance officer name, phone and email, and invoice prefix are configured. Hide or archive published demo listings before launch. See the [change guide](docs/CHANGE-GUIDE.md#complete-seller-details-and-policies-before-launch) for maintenance steps.

## Environment variables

`server/.env.example` contains development defaults and placeholders. Monetary environment settings are in rupees unless the field name ends with `Paise`.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Set to `production` to enable secure session cookies, HSTS, and the launch check. |
| `MONGODB_URI` | Development or deployment database URI. |
| `PORT` | API port. Defaults to `3000`. |
| `JWT_SECRET` | Random secret of at least 32 bytes. |
| `ADMIN_REQUIRE_2FA`, `ADMIN_TOTP_KEY` | Authenticator enrollment is mandatory in production. An optional stable 64-character hex key encrypts authenticator secrets. |
| `ADMIN_TRUST_LOOPBACK_PROXY` | Enable only when a trusted proxy on the same host overwrites forwarded IP headers. Without it, IP limits use the direct peer address. |
| `CORS_ORIGINS` | Comma-separated HTTP(S) origins without trailing slashes. |
| `PAYMENT_ONLINE_ENABLED` | Defaults to `false`. Online payment currently returns an unavailable response when enabled. |
| `COD_FEE` | Cash on Delivery charge. Defaults to zero. |
| `COD_MIN_ORDER_VALUE`, `COD_MAX_ORDER_VALUE` | Merchandise subtotal limits before fees and discounts. The maximum is unlimited when blank. |
| `DELIVERY_FEE`, `FREE_DELIVERY_MIN_ORDER_VALUE` | Flat delivery charge and optional free-delivery threshold. |
| `ORDER_DELIVERY_ESTIMATE`, `DELIVERY_PINCODE_RULES` | Default delivery estimate and optional JSON prefix rules such as `[{"prefix":"411","estimate":"2–3 business days","cod":true}]`. |
| `FIRST_ORDER_DISCOUNT_PERCENT`, `COUPONS_JSON` | Defaults for the first-order offer and initial coupon records. Edit live offers through the admin API. |
| `COD_OPEN_PER_PHONE`, `COD_OPEN_PER_ADDRESS`, `COD_FIRST_ORDER_MAX`, `COD_CONFIRM_ABOVE`, `COD_UNDELIVERED_*` | Initial COD risk defaults. Monetary environment values are in rupees. |
| `BUSINESS_KEY_SECRET`, `ORDER_RETENTION_DAYS` | Stable secret for private lookup keys and tokens, and days to keep anonymized orders from order creation. |
| `SELLER_NAME`, `SELLER_ADDRESS`, `SELLER_STATE` | Seller identity snapshotted on each order. Match the state name used at checkout for GST splitting. |
| `GST_REGISTERED`, `SELLER_GSTIN` | Defaults to false and issues a bill of supply without tax lines. If true, enter the seller name, address, state and GSTIN. |
| `ORDER_EMAIL_ENABLED`, `ORDER_EMAIL_FROM` | Enable order email and set your verified sender address. |

The first settings read saves the defaults into MongoDB. After that, use the admin settings API to change store details and checkout rules. The storefront’s public details are available at `/api/store-info`. Before launch, complete seller and grievance contacts, policy terms and real product disclosures using the [change guide](docs/CHANGE-GUIDE.md#complete-seller-details-and-policies-before-launch).
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

For a storefront review, run the preview with seeded products and try 1366×768, 1536×864, 1920×1080, 768×1024, and 390×844. On desktop, start in Cars, step to RC, scroll into the shop, and scroll back into RC. Reload a scrolled home page and repeat using the browser Back button. On mobile, use the four static garage buttons and place a guest COD order in a disposable database. Follow its tracking link, then check sign-in, the wishlist, and an unknown URL.

## Folder structure

- `client/src/app` groups storefront pages into folders such as `home`, `catalog`, `product-detail`, `cart`, and `orders`.
- `client/src/app/ui`, `motion`, and `car-viewer` contain the shared UI, animations, and product viewer.
- `server/src/routes` connects HTTP endpoints to `controllers`. Controllers validate requests and shape responses.
- `server/src/services` holds business rules and database workflows. `models` defines stored documents, `middleware` handles HTTP concerns, and `utils` holds configuration and helpers.
- `server/scripts` contains sample products and seeding. `server/test` contains the HTTP regression suite.

See [Architecture](docs/ARCHITECTURE.md) and [Change guide](docs/CHANGE-GUIDE.md).
