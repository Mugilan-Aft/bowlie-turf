
-- Revoke EXECUTE from anon/authenticated/PUBLIC on SECURITY DEFINER functions
-- that should only be invoked internally (triggers, maintenance, admin work).
-- App-facing RPCs (get_booked_slots, get_open_squad_posts, get_squad_post,
-- get_tournament_capacity, check_in_booking) keep their grants.

DO $$
DECLARE
  fn text;
  internal_fns text[] := ARRAY[
    'public.handle_new_user()',
    'public.log_booking_status_change()',
    'public.prevent_booking_overlap()',
    'public.squad_request_guard()',
    'public.squad_post_sync_counts()',
    'public.squad_post_set_emergency_expiry()',
    'public.squad_post_expire_due()',
    'public.validate_booking_add_on_price()',
    'public.guard_turf_approval_fields()',
    'public.log_squad_request_event()',
    'public.guard_booking_update()',
    'public.validate_booking_pricing()',
    'public.touch_updated_at()'
  ];
BEGIN
  FOREACH fn IN ARRAY internal_fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;
