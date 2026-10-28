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
- Assistant conversations are account-owned and expire after 24 hours; provider errors do not persist a failed turn.
- Assistant cart mutations require an explicit add-to-cart request and a named product or product ID; these are audited through the existing v1 event schema.
- Product navigation actions are limited to validated product detail paths; checkout and refund tools are not exposed.
- Assistant requests reject untrusted origins, ignore request-supplied customer identity, fail closed on policy errors, and avoid storing prompt text in audit events.
- Malformed search arguments, instruction-like review text, cross-account conversation IDs, and provider failures cannot create unauthorized cart writes.

The [assistant security matrix](assistant-security.md) defines these local checks and separates them from hosted deployment acceptance.

`cd store; npm run build` checks TypeScript and produces the production static bundle.

## Manual browser checks

- At desktop width, check header search/account/orders/cart, bow-style tiles, category navigation, hero, grid, product pages, and footer.
- At 390px width, check no horizontal page overflow, scrolling category navigation, two-column product grid, and stacked product/cart pages.
- Search for recurve; combine with Recurve bows; try an unmatched search and clear filters.
- Follow a product link, use browser back, and reload a deep link.
- Add to cart while signed out: account dialog opens. Sign in and add again.
- Alice: add two Ridgeline recurve bows, confirm $378.00, decrement, remove, refresh, and sign out/in.
- Add a beginner recurve, arrows and target; inspect fictional draw weights and use-case labels on the item pages.
- From Alice's cart, review the demo address and items, place a fictional order, confirm the cart clears and the new order appears in My orders. No payment fields should appear.
- Open Alice's order, then directly request Bob's order using the address bar. Confirm Access denied and no Bob address.
- Switch to Bob: verify Bob's separate orders and cart.
- With `GROQ_API_KEY` configured server-side, ask Ask Archery Pro to find a product, open a named product, and add an explicitly named product to Alice's cart. Switch to Bob and confirm the conversation and cart are separate.
- Test without a provider key or with provider failure: the chat reports an error without inventing results, and the rest of the store remains usable.
- Sign out; direct order URLs require sign-in. Check wrong password errors.
- Inspect audit JSON with `python -m backend.audit`; no session tokens or passwords appear.
- Check keyboard focus indicators, dialog dismissal with Escape, and controls at mobile width.
- Confirm real payments are absent and the assistant has no checkout or refund capability.

Browser visual/interaction checks were not automated in the initial implementation because the in-app browser runtime was unavailable. Build and API tests do not substitute for these visual checks.
