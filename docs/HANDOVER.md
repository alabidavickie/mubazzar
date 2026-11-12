# MUBAZZAR: handover guide

Live site: https://www.mubazzar.com · Admin: https://www.mubazzar.com/login (Staff & riders tab)

## Who can sign in, and where they land
| Role | Signs in with | Lands on | Can do |
|---|---|---|---|
| Customer | Email code (no password, no phone) | /account | See their orders, saved addresses, wishlist |
| Admin (owner) | Email + password | /admin | Everything |
| Staff (order desk) | Email + password | /admin (Dashboard + Orders only) | Chat with customers, record payments, update order status, assign riders |
| Rider (dispatcher) | Email + password | /dispatch | Only orders assigned to them: call/WhatsApp/map, mark delivered or failed with a photo |

Only an admin can create staff and riders. Nobody can sign up for those roles.

## Create the first admin (once)
1. Supabase → your project → Authentication → Users → Add user → email + a strong password → Create.
2. Supabase → SQL editor, run (use the same email):
   ```sql
   update public.profiles set role = 'admin', full_name = 'Your Name' where email = 'you@example.com';
   ```
3. Go to /login → "Staff & riders" tab → sign in. You land on /admin.

## Add staff or a rider
Admin → Staff & riders → name, email, role (Staff or Dispatcher), temporary password → Create account.
Send them the email and password privately and ask them to keep it safe. To stop someone, open them in the same page and deactivate the account.

## Daily workflow
1. A customer orders. You get an email, and the order appears in Admin → Orders as "Awaiting chat".
2. Open it, tap the WhatsApp button, confirm the order and agree the delivery fee and time with the customer.
3. On the order, tap "Pay on delivery agreed" and set the status to Confirmed. Assign a rider (the rider sees it on /dispatch).
4. Rider delivers and records the cash or POS collected and a photo (or a reason if it failed). The rider can only record money on orders marked "Pay on delivery agreed".
5. The order shows as paid and delivered. Everything is kept in the audit log.
Unconfirmed orders cancel automatically after 48 hours and their stock is released.

## One shop location (run once)
The database was built for three dispatch hubs. To run from Ibadan only, paste `supabase/maintenance/one-location.sql` into Supabase → SQL editor → Run. Admin then shows one "Stock" box per product and no hub choices. It is safe to re-run and loses no stock or orders.

## What the owner controls in Admin (no code needed)
Products (photos, price, stock, video links from Facebook/Instagram/TikTok/X/YouTube) · Flash deals · Homepage text, address, support WhatsApp/email, Facebook and WhatsApp channel links · Delivery fees (optional) · WhatsApp numbers (bank details are optional: customers pay on delivery) · Staff and riders.
Support email is optional: clear it in Admin → Homepage and it disappears from the site.

## Accounts that must belong to the client
Domain registrar · Vercel (hosting) · Supabase (database) · Resend (email) · GitHub (code). Transfer them, then change the passwords.
