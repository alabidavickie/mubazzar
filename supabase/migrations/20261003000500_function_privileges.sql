-- Lock down function execution. Supabase's default privileges grant EXECUTE on new public functions
-- to anon/authenticated (and Postgres grants it to PUBLIC), which would expose internal
-- security-definer helpers such as _apply_status through the Data API. Revoke everything, then
-- grant back only the intended surface. Functions created by later migrations must grant explicitly.

revoke execute on all functions in schema public from public, anon, authenticated;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- Callable by guests and signed-in users (pure helpers, RLS helpers, public tracking).
grant execute on function
  public.current_app_role(),
  public.is_admin(),
  public.is_staff(),
  public.lagos_now(),
  public.effective_unit_price(uuid),
  public.quote_delivery(text),
  public.compute_payment_status(bigint, bigint, bigint, boolean, public.payment_status),
  public.order_transition_allowed(public.order_status, public.order_status),
  public.immutable_tags_text(text[]),
  public.track_order(text, text)
to anon, authenticated;

-- Signed-in users; each function checks the caller's app role internally.
grant execute on function
  public.set_order_status(uuid, public.order_status, text),
  public.add_order_note(uuid, text),
  public.set_payment_agreement(uuid, text, text),
  public.record_payment(uuid, bigint, public.payment_method, text, text, text, public.payment_kind),
  public.assign_dispatcher(uuid, uuid, text),
  public.complete_delivery(uuid, bigint, public.payment_method, text, text),
  public.fail_delivery(uuid, text, text),
  public.submit_review(uuid, uuid, int, text, text),
  public.review_supplier(uuid, boolean, text),
  public.review_supplier_product(uuid, boolean, text, bigint),
  public.adjust_inventory(uuid, uuid, int, int, text)
to authenticated;

-- Everything else (create_order, cancel_stale_orders, claim_payment, log_chat_click, _internal helpers,
-- trigger functions) is reachable only by the table owner / service role, i.e. trusted server code.
