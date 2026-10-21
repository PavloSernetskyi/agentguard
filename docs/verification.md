# Local verification

## Automated

`python -m unittest discover -s tests -v` uses fresh temporary databases and checks:

- Alice's own order succeeds; Bob's order is denied and both outcomes are audited.
- Orders and persistent carts are isolated by validated identity.
- Query/body customer IDs and forged session cookies cannot impersonate Bob.
- Login rotation, expiration, and logout invalidate sessions.
- Invalid quantities and untrusted mutation origins are rejected.
- Product search works and data survives reopening storage.
- Authorization exceptions deny access; permissive policies cannot override ownership.
- An allowed operation that fails validation records execution `failed` separately.
- Unknown and non-owned order IDs both return 403.

`cd store; npm run build` checks TypeScript and produces the production static bundle.

## Manual browser checks

- At desktop width, check header search/account/orders/cart, category navigation, hero, grid, product pages, and footer.
- At 390px width, check no horizontal page overflow, scrolling category navigation, two-column product grid, and stacked product/cart pages.
- Search for headphones; combine with Electronics; try an unmatched search and clear filters.
- Follow a product link, use browser back, and reload a deep link.
- Add to cart while signed out: account dialog opens. Sign in and add again.
- Alice: add two headphones, confirm $158.00, decrement, remove, refresh, and sign out/in.
- Open Alice's order, then directly request Bob's order using the address bar. Confirm Access denied and no Bob address.
- Switch to Bob: verify Bob's separate orders and cart.
- Sign out; direct order URLs require sign-in. Check wrong password errors.
- Inspect audit JSON with `python -m backend.audit`; no session tokens or passwords appear.
- Check keyboard focus indicators, dialog dismissal with Escape, and controls at mobile width.
- Confirm checkout is disabled and Ask DemoMart says coming later.

Browser visual/interaction checks were not automated in the initial implementation because the in-app browser runtime was unavailable. Build and API tests do not substitute for these visual checks.
