# Known Issues / Blockers

Items here genuinely need owner input or an environment the build machine lacks. Each has the exact reason and fix.

## Needs the owner before going live
1. **Connect the live database and keys** — the Supabase project `mubazzar` (ref `nzwwkscsfattufixumwx`, London `eu-west-2`) is created with all migrations applied and the production seed loaded (43 products, 37 delivery zones, 3 hubs, settings). Until Vercel has `DATABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (+ `AUTH_SECRET`, `CRON_SECRET`, `IP_HASH_SALT`, Supabase URL/anon key — README §2), `/api/health` reports `ENOENT … /var/task/.data/pglite` and every database-backed page returns 500. Optional services: Meta Pixel + CAPI, Termii (SMS + sender ID), Resend (email + verified domain), WhatsApp Cloud API — without them the mocks run (messages land in `notifications_outbox` / `meta_events`). Leftover from loading the database (harmless, remove in the Supabase SQL editor): `drop schema mbz_tmp cascade; drop extension pg_net;`.
2. **Real WhatsApp numbers, social handles and bank accounts** — the seed uses placeholders (`+234 812 000 8899/8900`, `mubazzar.ng`, account `0000000000`). Fix: Admin → Chat & payments (README §6).
3. **Business details** — CAC number (shown only when it's a real RC/BN number), registered address, support contacts. Fix: Admin → Homepage.
4. **New-order alert recipients** — empty in the production seed. Fix: Admin → Chat & payments → New-order alerts.
5. **Owner admin account** — created once in Supabase (README §4.1 step 5); everyone else is created from Admin → Staff & riders.

## Environment notes (no action needed for the product)
- **Lighthouse "simulate" vs DevTools throttling** — CI measures with DevTools slow-4G throttling (LCP 1.7–1.8 s). Lantern's simulated mode reports 2.4–3.3 s for the same build because it ignores request priority; details and numbers in DECISIONS.md → "Performance measurement".
