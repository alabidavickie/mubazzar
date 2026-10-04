# Known Issues / Blockers

Items here genuinely need owner input or an environment the build machine lacks. Each has the exact reason and fix.

## Needs the owner before going live
1. **Live service keys** — Supabase (URL, anon key, service-role key, pooler `DATABASE_URL`), Meta Pixel + CAPI token, Termii (SMS + sender ID), Resend (email + verified domain), optional WhatsApp Cloud API. Without them every adapter runs its mock (messages land in `notifications_outbox` / `meta_events`). Fix: add them in Vercel env vars (README §2, §5).
2. **Real WhatsApp numbers, social handles and bank accounts** — the seed uses placeholders (`+234 812 000 8899/8900`, `mubazzar.ng`, account `0000000000`). Fix: Admin → Chat & payments (README §6).
3. **Business details** — CAC number (shown only when it's a real RC/BN number), registered address, support contacts. Fix: Admin → Homepage.
4. **New-order alert recipients** — empty in the production seed. Fix: Admin → Chat & payments → New-order alerts.
5. **Owner admin account** — created once in Supabase (README §4.1 step 5); everyone else is created from Admin → Staff & riders.

## Environment notes (no action needed for the product)
- **Pushing to GitHub was refused (HTTP 403) from the cloud build session** — the Claude GitHub App isn't installed on `alabidavickie/mubazzar` (or the account link needs refreshing). All work is committed on branch `claude/wonderful-brahmagupta-8h6a26` locally in that session. Fix: install the app / reconnect GitHub at https://claude.ai/connect-github, then push the branch.
- **Lighthouse "simulate" vs DevTools throttling** — CI measures with DevTools slow-4G throttling (LCP 1.7–1.8 s). Lantern's simulated mode reports 2.4–3.3 s for the same build because it ignores request priority; details and numbers in DECISIONS.md → "Performance measurement".
