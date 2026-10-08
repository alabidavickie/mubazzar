# Real-person test checklist (before launch)

Run this on the **live site** after Supabase and the live keys are in (README §2–§5). Each tester uses
their **own Android phone on mobile data** (not Wi-Fi) and real WhatsApp. Tick each box; for anything
odd, write the step number, what you expected, what happened, and attach a screenshot.

Who: **Shopper** (someone who has never seen the site) · **Staff/Admin** (on a laptop) · **Rider** (on a phone).
Time: about 45 minutes together. Use small real orders and cancel them at the end (step 30).

## Shopper — first visit (don't explain the site to them)
- [ ] 1. Open the site from a WhatsApp/Instagram link. Does the home page appear in under ~3 seconds on mobile data?
- [ ] 2. Without help, can you tell what the shop sells and that you pay in chat (no card)?
- [ ] 3. Find a product with the search icon. Open it. Are the photos, price and delivery fee clear?
- [ ] 4. Is the stock or "only X left" message believable? (It must match Admin → Inventory.)
- [ ] 5. Add to cart, change quantity, remove it, add it again. Does the cart total make sense?
- [ ] 6. Go to checkout. Tap **Place Order** with nothing filled. Are the error messages clear?
- [ ] 7. Fill your real name, WhatsApp number, state, LGA and address. Place the order.
- [ ] 8. On the thank-you page: is the order number visible? Tap **Complete payment on WhatsApp**.
- [ ] 9. Does WhatsApp open to the right business number with the order message already typed? Send it.
- [ ] 10. Did you get the "we received your order" SMS? Note how long it took.
- [ ] 11. Open **Track** and enter your order number and phone. Does it show the right status and total?
- [ ] 12. Try a landing page link (e.g. `/lp/car-vacuum`) and order from it with **Quick Order**. Is it fast and simple?

## Shopper — account
- [ ] 13. Sign in with your phone number. Does the login code arrive by SMS? Does it work?
- [ ] 14. Do your earlier orders show under **My account**?
- [ ] 15. Save an address; start a new order. Is the form filled in for you?
- [ ] 16. Add a product to your wishlist, sign out, sign back in. Is it still there?

## Staff / Admin (laptop, then once on a phone)
- [ ] 17. Sign in at `/login`. Did the new-order email/SMS alert arrive for the shopper's order?
- [ ] 18. Find the order in **Orders** by number, by name and by phone.
- [ ] 19. Reply to the shopper's WhatsApp, then tap **Mark in chat**.
- [ ] 20. Record the payment (method, bank reference, tick "money has arrived"). Does the payment badge change?
- [ ] 21. **Confirm order**. Did the shopper get the "confirmed" SMS?
- [ ] 22. Assign the rider. Does the order show **Dispatched**?
- [ ] 23. Print the order slip. Is it readable on paper?
- [ ] 24. Change one product's price in **Products**. Does the shop show the new price within a minute?
- [ ] 25. Open **Chat & payments** and check the WhatsApp numbers, bank accounts and alert recipients are the real ones.
- [ ] 26. **Products → New product**: add a real product with 2–3 photos, a price and one package. Then open its landing page `/lp/<product link>` on a phone and place a test order from it.
- [ ] 27. **Landing pages** lists every product. Tap **Open** on three of them: each loads with that product's photos, price and order form.
- [ ] 28. Sign in as **order staff**: **Products → New product** must be refused (only the admin adds products). Also confirm `/sell` and `/supplier` show "page not found".

## Rider (phone)
- [ ] 29. Sign in. Is the assigned order listed with the right address and "paid / collect ₦X" amount?
- [ ] 30. Tap the customer's phone number. Does it open the dialler? Is the address enough to find the place?
- [ ] 31. Mark it **Delivered** (take a proof photo if asked). Did the shopper get the "delivered" SMS?

## Wrap-up
- [ ] 32. Admin cancels/refunds the test orders and checks stock went back up in **Inventory**.
- [ ] 33. Each tester: what was confusing, slow, or made you hesitate to buy? Write it down.
- [ ] 34. Admin → **Homepage**: switch sample reviews off for launch.
