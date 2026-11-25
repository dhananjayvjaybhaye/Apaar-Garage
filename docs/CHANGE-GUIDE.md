# Change guide

## Add a product category

1. Add the category to the appropriate product type in `server/src/utils/product-input.js`. The model and query validators use those values.
2. Update the corresponding category list and label in `client/src/app/catalog/product.ts`. The catalog reads these values for its filters.
3. Add sample data in `server/scripts/products.js` or `server/scripts/rc-products.js` if needed. If the category belongs in the garage, update its zone mapping in `garage-path.ts` and its featured query in `home.ts`.
4. Verify listing, filtering, and detail responses. Keep existing category IDs stable for saved URLs.

## Change theme colors

Start with the dark amber palette in `client/src/styles.css`. Change a shared variable such as `--accent`, `--amber`, or `--background`, then check text and control contrast. If you change the page background, update the browser bar color in `client/src/index.html` as well. The Three.js garage has its own material palette in `garage-renderer.ts`.

## Change animation speed

Edit `hero.config.ts` for the canvas fade and camera animations. The `heroSteps` settings control the dolly, cooldown, wheel sample window, quiet period, swipe threshold, 24 px anchor tolerance and 700 ms handoff. In a development build, add `?debugScroll=1` and open the browser console to inspect wheel units, deltas, timestamps, and pinch signals. Test a mouse notch, a light two-finger swipe, a long swipe with momentum, a reversal, and scrolling back into RC from below. Focus a hero link and verify normal browser key handling. Leave the stall timeout longer than the move so the page returns to normal scroll if rendering stops. Edit `category-stages.css` for category heading size and section spacing, and `category-scenes.config.ts` for the reveal timings. Test both normal motion and reduced motion.

The `heroScene` values in `hero.config.ts` control the zoom and emphasis of the active case. `activeZoneFill` sets the case width as a fraction of the garage opening beside the headline, and `signTopMargin` sets the minimum clearance in CSS pixels. `desktopFrame` and `compactFrame` set the case's screen position. The projection test covers all four zones at 1366×768, 1440×900, 1920×1080, and 2560×1440. `inactiveBrightness` controls the dimming, and the dolly distances use Three.js world units. Check all four zone centers and the transitions on a wide and narrow screen after changing these values.

## Populate an empty RC bench

Run `npm.cmd run seed` from `server` to load the sample listings into the database configured in `server/.env`. The seed includes 15 RC products. Check `GET /products?productType=rc&sort=featured&limit=8` on the running API. The home category uses the RC product type, which includes all supported `rc-*` categories. Use End to reach the RC display in the 3D hero, or choose RC in the static hero, after the seed completes.

## Check the home category layouts

With a seeded API and the production preview running, install the optional browser test dependency from `client` and run the check. It needs an installed copy of Chrome.

```powershell
npm.cmd install --no-save --package-lock=false playwright-core
node scripts/check-category-layout.mjs
```

Set `PREVIEW_URL` when using a different preview port. The check measures the last product and View all card on all four sections, then simulates loading and an empty inventory. Keep bottom padding on the section and clipping on its decorative backdrop so the card shadows and tilt stay visible.

## Publish products and manage inventory

Use an existing administrator account with the admin API. Create a product with `POST /admin/products`, read it by slug with `GET /admin/products/:slug`, and send changed fields using `PATCH /admin/products/:slug`. To publish, set `status` to `published`. A 400 response includes a `details` array with each missing or invalid field. Use `PATCH /admin/products/:slug/stock` with a signed integer `delta` for a stock adjustment. The order, product and stock APIs do not physically delete inventory records.

## Dispatch and handle returns

Open **Admin → Orders** to search by order number, name, phone, or pincode. Date filters use inclusive India Standard Time dates. CSV export includes every matching order in the selected sort order. The export contains customer contact data, and formula-like strings are escaped for spreadsheets.

Open an order to review tax, risk flags, the status timeline, and internal notes. The server determines which fulfillment actions appear. Record customer confirmation before packing when required. The order detail links to its packing slip and, after dispatch, its invoice or bill of supply. Mark COD collected after delivery.

- For direct list and export access, use `GET /admin/orders` and `GET /admin/orders/export` with the same filters. The list includes the page and total count. Export ignores the page parameter.
- Send `PATCH /admin/orders/:orderNumber/status` with `status: "shipped"` and optional `shipment` fields `courier`, `awb` and `trackingUrl`. This creates the invoice or bill, available from order tracking or `GET /orders/:orderNumber/invoice`.
- A failed delivery uses `status: "undelivered"` with `reasonCode` set to `refused`, `unreachable`, or `failed_attempts`. Once the parcel arrives back, send `status: "returned_to_seller"` and a `condition` of `resalable` or `damaged`.
- Customers submit `POST /orders/:orderNumber/returns` with a reason such as `damaged` and `items: [{ "slug": "product-slug", "quantity": 1 }]`. Use the same endpoint with GET to see their requests. Staff review with `GET /admin/orders/:orderNumber/returns` and update with `PATCH /admin/orders/:orderNumber/returns/:id`. When receiving, include the condition for each item as `items: [{ "slug": "product-slug", "condition": "resalable" }]`. After recording COD collection, a refund can be recorded in paise with `refundAmountPaise`.
- Use `POST /admin/orders/:orderNumber/notes` and `PATCH /admin/orders/:orderNumber/confirmation` for internal notes and customer confirmation. The customer return workflow is available through the API.

Open **Admin → Returns** for the cross-order queue. Open a request to approve or reject it. When receiving, choose resalable or damaged for each line. Receiving restocks resalable lines once. A refund records the amount already paid back and requires collected payment. The return screen also records replacements.

## Create the first administrator

From an interactive terminal in `server`, run `npm.cmd run create-admin` on Windows or `npm run create-admin` on macOS or Linux. Use the target database’s `MONGODB_URI`. Enter the email and type the new password twice. The password is hidden and must be at least 12 characters and at most 72 UTF-8 bytes. If that email already belongs to an account, the command promotes it, sets the password you entered, and requires the account to sign in again.

Sign in at `/admin/login`. The store login keeps using its separate customer session. Admin sessions require a fresh sign-in after 30 minutes without activity or after 12 hours at most. The dashboard warns shortly before expiry.

Production requires an authenticator. Set `ADMIN_REQUIRE_2FA=true` to test the same flow in development. Sign in with your password, generate the QR code, scan it in an authenticator app, and enter the current six-digit code. Store the recovery codes offline. On future sign-ins, enter a current authenticator code or one unused recovery code. Keep `ADMIN_TOTP_KEY` stable if configured. It must be 64 hex characters from a secure random source. Without it, the key is derived from `JWT_SECRET`.

From `server`, run `npm.cmd run remove-admin` on Windows or `npm run remove-admin` on macOS or Linux. Enter the email and type `REMOVE` to confirm. This revokes admin sessions immediately and removes the old authenticator enrollment. The account can still use the storefront. An operator with database access can use the remove and create commands to re-enroll an administrator who has lost both the authenticator and all recovery codes.

For direct admin API requests, sign in using `POST /auth/admin/login`, keep the admin cookie, and send the returned token as `X-Admin-CSRF` on writes. A non-renewing session check is available at `GET /auth/admin/session`. Owners can view the latest audit entries on the dashboard.

## Admin permissions

`server/src/config/admin-permissions.js` defines the roles. The session API returns the granted permissions, which the admin shell uses for navigation and controls. Legacy admin accounts without an explicit access level use the staff permissions.

| Capability | Owner | Staff |
| --- | --- | --- |
| Dashboard | View | View |
| Orders, returns, and support | Work on records and view full contact details | Work on records, view masked lists, and open individual orders and tickets |
| Products | View, edit, import, export, and see cost price | View with cost price omitted |
| Store settings and launch readiness | View and edit | View |
| Customer directory and CSV | View and export | — |
| Orders CSV and newsletter CSV | Export | — |
| Newsletter | View and manage | View masked subscriber list |
| Coupons and blocked contacts | Manage | — |
| Audit activity | View | — |
| Admin users | Provision from the server terminal | — |

Staff can search by a complete phone number or email they already have. Partial phone and email searches are available to owners. Full contact disclosures in admin detail views, packing slips, owner lists, and exports create a `privacy.contact_viewed` audit entry with the actor, record or list reference, and field names. The entry omits the contact values.

## Manage products in the admin panel

1. Sign in at `/admin/login`, open **Products**, and choose **Create product**.
2. Fill the listing details, compliance declarations, and RC specifications where applicable. The **Missing before publishing** checklist updates as you edit and uses the same compliance rules as the API. Use **Save draft** with the required fields marked by an asterisk. Select **Publish** after filling in the additional compliance fields. A failed save focuses the error summary. Each link moves focus to the relevant field. Add optional tags one per line. The SEO title and description override storefront page and share metadata when provided. If your session expires, sign in again as the same admin in the same tab to recover the draft. Refreshing the page discards the in-memory draft.
3. Upload JPG, PNG, or WebP photos up to 5 MB each. Add meaningful alt text, then use **Set primary**, **Up**, or **Down** for the order used by the storefront. Upload a self-contained GLB up to 10 MB and use **Preview model** to check it. Models over 5 MB show a size warning.
4. Save the product. On an existing listing, use **Stock adjustment** to enter a signed whole-unit change and a reason. Use **Duplicate** in the table to create a draft with zero stock and a new product URL. Assign it a new SKU and barcode before publication as applicable.
5. Select rows to publish or hide them together. If a listing fails the publication check, the bulk publish leaves the selection unchanged and shows the issues.

Set all three Cloudinary variables in `server/.env` for production uploads. Development can use the ignored `server/uploads` folder without Cloudinary. Move development assets to production storage and update their URLs before deploying listings that use them.

## Complete seller details and policies before launch

Open **Admin → Settings** as a store owner and follow the launch readiness checklist. If the production check blocks startup, use the development API on the host’s loopback interface to fix the settings and hide or archive published placeholders. In PowerShell, run `$env:NODE_ENV = 'development'` in the server terminal before `npm.cmd start`. Keep that maintenance process private. Restart with `NODE_ENV=production` once the check passes. Review the result on `/seller-information`, in the footer, and at `/api/store-info`.

- Set the seller’s legal name, trade name and full business address. Verify the seller state and the GST registration setting. Supply the GSTIN if registered.
- Fill in the customer care phone, email and hours, plus the grievance officer’s name, designation, email, phone and address.
- Fill `policyDetails.returnConditions`, `nonReturnableItems`, `refundTimeline`, `exchangeTerms`, `warrantyTerms`, and `otherDataRetention` with the store’s actual terms. Verify the default return window, delivery estimate, pincode rules, and configured anonymized-order retention.
- Replace demo listings with real product data. Verify the MRP inclusive of taxes, selling price, net quantity, origin, manufacturer or importer details, age grade, warranty, return window, and battery transport notes. Supply the actual BIS licence and an authorized packaging image in `isiMarkImageUrl` where applicable. The storefront displays the image only with a declared certification and licence.
- Update the checkout policy version in `server/src/config/store-policy.js` when substantially changing what buyers agree to. Checkout records the version and time on the order. Direct `POST /orders` callers must send `acceptPolicies: true` after obtaining the customer’s agreement. Update the newsletter consent version in the server and home signup together if its consent wording changes.

## Change store settings and COD rules

Edit settings in rupees under **Admin → Settings**. Staff have read-only access. To grant an existing account owner access, run `npm run create-admin -- --owner` from `server` against the target database. Use `--staff` when provisioning staff accounts. These commands rotate the password and end existing admin sessions. Administrators created before owner access was introduced can read settings until an owner grant is assigned.

For direct API access, use `GET /admin/settings` for the full settings record and `GET /admin/settings/readiness` for the launch blockers. Save with an owner session and `PUT /admin/settings`. The settings API uses integer paise and validates edited fields with the same rules used at startup. Each settings change creates an audit entry. Changes take effect when saved on the current API instance. Other instances refresh within 30 seconds.

- By default, the store allows two open COD orders per normalized mobile number and three per normalized address over the last 24 hours. The first-order cap is ₹2,500 until there is a delivered COD order for that phone or account. A total over ₹4,000 needs customer confirmation. Both risk thresholds use the final payable amount.
- The default repeated-failure rule flags three undelivered COD orders within 90 days. Set `risk.repeatedUndeliveredAction` to `block` to refuse subsequent COD orders. Use **Admin → Blocked contacts** to add or remove manual blocks. A phone and pincode on the same rule match that combination. The admin form requires a reason for both actions and records it in the audit log. For flagged or high-value orders, record customer confirmation before packing.
- Set `codFeePaise`, `codMinPaise`, `codMaxPaise`, `deliveryFeePaise`, and `freeDeliveryThresholdPaise` in settings. Checkout uses the **merchandise subtotal after discount** for free delivery, before shipping and COD fees. The cart’s estimate is based on the cart contents before checkout discounts.
- Use `serviceablePincodeRules` for exceptions. The longest matching prefix wins. Set `serviceable: false` to turn off checkout for a prefix. A product-specific return window overrides the store default on new orders.

## Manage coupons

Use **Admin → Coupons** to create, edit, activate, or retire a code. Schedules in the form use IST. Usage is recorded when an order is placed, and editing or retiring an offer preserves its redemption count. A coupon replaces the automatic first-order discount on an eligible signed-in order. Guest usage is checked with the shipping phone at checkout.

Use `GET /admin/coupons` to list codes, `POST /admin/coupons` to create a unique code, and `PUT /admin/coupons` to save an edit. The body accepts `code` and either `percent` or `amountPaise`, with optional `active`, `minimumPaise`, `startsAt`, `endsAt`, `totalLimit`, and `perCustomerLimit`.

## Manage tickets, consent and account data

- **Admin → Support** shows ticket deadlines and lets staff filter overdue tickets, post replies visible in the customer thread, and advance ticket status. The first staff reply also acknowledges an open ticket. Acknowledgement is due within 48 hours. The resolution deadline is the earlier of one calendar month and 30 days. Customers check status with `POST /support/status` using their ticket number and email.
- **Admin → Customers** shows registered accounts and their linked order counts and totals. Order value excludes cancellations. Collected totals are gross before refunds.
- **Admin → Newsletter** lists active and unsubscribed records. Its CSV includes active subscriptions with recorded consent and respects the email search. An authorized sender can request a token from `POST /admin/newsletter/unsubscribe-token` with `email`. Configure the sender to POST to `/api/newsletter/unsubscribe/:token` for one-click unsubscribe. A human-readable email link can open `/newsletter/unsubscribe#<token>` on the storefront.
- Signed-in customers can download their linked data and close their account from `/account/privacy`. Closing requires the current password and completion of open orders or returns. Tickets and newsletter records are linked when submitted while signed in using the account email. For older or guest records, use the support channel where ownership can be checked. MongoDB expires anonymized order records after the configured retention period.

## Import products

Follow the [product import guide](PRODUCT-IMPORT.md) for sheet preparation, image matching, draft confirmation, and optional document prefill.

## Add a form field

Use `FormField` with the `FieldControl` directive in `client/src/app/ui/form-field`. Give each native control a stable ID through its field, and keep validators and submission in the page. The field handles the label, optional hint and unit, inline error and ARIA links. Place the fields directly inside a `form-grid` with a `form-grid-container` ancestor. The grid chooses one, two or four columns from the space available. Use `form-grid-compact` to cap it at two.

Run `npm run build` and then `npm run test:forms` from `client` after installing both workspaces' dependencies. The browser test uses a disposable MongoDB fixture and local Chrome. Set `CHROME_BIN` if Chrome is installed in a different location.

## Add a page

Create a standalone component under the relevant `client/src/app` folder. Register it with `loadComponent` and a title in `app.routes.ts` before the wildcard route. Add a navigation link where shoppers need it. Use the auth guard if the page requires an account. Verify navigation by link and by opening the URL directly.

For a public page, add its title and description in `client/src/app/seo/metadata.mjs`, then regenerate the deployment files and check the URL in `sitemap.xml`. The same file controls canonical catalog categories. Add new category IDs there when adding categories that should be discoverable in search.

## Update the FAQ and New Arrivals

Edit question text and answers in `client/src/app/ui/faq-content.ts`. The home page chooses its questions by ID, and the support page shows the full list. Adjust the New Arrivals count in `client/src/app/home/home-content.config.ts`. Verify that the accordion opens by keyboard and the latest listings still appear first.

## Tune the ambient background

Edit the layered artwork in `client/src/app/ui/garage-ambience.css` and the SVGs in `client/public/images/ambient`. The reusable `Parallax` directive controls how decorative layers move.

## Brand artwork

The original 1254 px artwork lives at `design/apaar_garage_rc_racing_logo.png`. Angular only copies web assets from `client/public`, so the master stays out of the production site.

| Files | Use |
| --- | --- |
| `client/public/logo/header.webp`, `header@2x.webp`, `header.png`, `header@2x.png` | Tight transparent crops at 140 × 75 and 280 × 150. The PNG also works in order emails. |
| `client/public/logo/display.webp` | Higher-resolution artwork for the garage entrance and footer. |
| `design/wheel.svg` and `client/public/logo/favicon.svg` | Editable red wheel artwork and its web export. |
| `client/public/logo/favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | Browser and launcher icons, including a maskable variant with safe padding. |
| `client/public/logo/share.jpg` | Default 1200 × 630 Open Graph and Twitter image with the home page tagline. |
| `client/public/logo/organization.png` | Square image for Organization structured data. |
| `client/public/manifest.webmanifest` and `client/src/index.html` | App name, theme colors, launcher icons, and browser links. |

Replace the master PNG in `design/` with a transparent export. If the brand mark changes, update `design/wheel.svg` too. With server dependencies installed, run `node design/build-brand-assets.mjs` from the repository root. If the horizontal proportions change, update the generator's target dimensions and the width and height in `client/src/app/ui/brand-logo.ts` together. Run `npm --prefix client run test:brand` to check asset budgets and metadata links.

Set `ORDER_EMAIL_SITE_URL` in the server environment to the public HTTPS storefront origin to include the hosted PNG in emails. The name also appears as text in email clients that block images. Keep the logo URL reachable from outside the store session.
