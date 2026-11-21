# Change guide

## Add a product category

1. Add the category to the appropriate product type in `server/src/utils/product-input.js`. The model and query validators use those values.
2. Update the corresponding category list and label in `client/src/app/catalog/product.ts`. The catalog reads these values for its filters.
3. Add sample data in `server/scripts/products.js` or `server/scripts/rc-products.js` if needed. If the category belongs in the garage, update its zone mapping in `garage-path.ts` and its featured query in `home.ts`.
4. Verify listing, filtering, and detail responses. Keep existing category IDs stable for saved URLs.

## Change theme colors

Start with the dark amber palette in `client/src/styles.css`. Change a shared variable such as `--accent`, `--amber`, or `--background`, then check text and control contrast. If you change the page background, update the browser bar color in `client/src/index.html` as well. The Three.js garage has its own material palette in `garage-renderer.ts`.

## Change animation speed

Edit `hero.config.ts` for the hero entrance and camera animations. Edit `category-scenes.config.ts` for category section heights, scroll distances, and stagger timings. Test both normal motion and reduced motion.

## Change the COD fee

Set `COD_FEE` in `server/.env` to a nonnegative rupee amount with up to two decimal places, then restart the API. Use `COD_MIN_ORDER_VALUE` and `COD_MAX_ORDER_VALUE` for merchandise subtotal limits. The server recalculates the fee in the cart quote and on checkout.

## Add a page

Create a standalone component under the relevant `client/src/app` folder. Register it with `loadComponent` and a title in `app.routes.ts` before the wildcard route. Add a navigation link where shoppers need it. Use the auth guard if the page requires an account. Verify navigation by link and by opening the URL directly.

## Tune the ambient background

Edit the layered artwork in `client/src/app/ui/garage-ambience.css` and the SVGs in `client/public/images/ambient`. The reusable `Parallax` directive controls how decorative layers move.

