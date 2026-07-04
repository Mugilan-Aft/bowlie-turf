
-- 1) SECURITY DEFINER functions: revoke EXECUTE from public/anon/authenticated.
--    Only check_in_booking is invoked as RPC by signed-in users; re-grant it.
REVOKE EXECUTE ON FUNCTION public.check_in_booking(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_booking_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_turf_approval_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_booking_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.squad_post_expire_due() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.squad_post_sync_counts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_booking_add_on_price() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_booking_pricing() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_in_booking(uuid) TO authenticated;

-- 2) booking_participants: only the booking owner may add participants for their booking.
DROP POLICY IF EXISTS "Participants self insert" ON public.booking_participants;
CREATE POLICY "Participants self insert" ON public.booking_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_participants.booking_id
        AND b.user_id = auth.uid()
        AND b.status IN ('pending','confirmed','completed')
    )
  );

-- 3) bookings: install missing trigger that enforces guard_booking_update.
DROP TRIGGER IF EXISTS bookings_guard_update ON public.bookings;
CREATE TRIGGER bookings_guard_update
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_booking_update();

-- Ensure related validation/audit triggers exist too (no-op if already installed).
DROP TRIGGER IF EXISTS bookings_validate_pricing ON public.bookings;
CREATE TRIGGER bookings_validate_pricing
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_booking_pricing();

DROP TRIGGER IF EXISTS bookings_log_status_change ON public.bookings;
CREATE TRIGGER bookings_log_status_change
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.log_booking_status_change();

-- 4) live_matches: restrict insert/update to authenticated, require turf ownership.
DROP POLICY IF EXISTS "Owners manage matches" ON public.live_matches;
CREATE POLICY "Owners manage matches" ON public.live_matches
  FOR ALL TO authenticated
  USING (
    turf_id IS NOT NULL
    AND (private.is_turf_owner(turf_id) OR private.has_role(auth.uid(), 'admin'::public.app_role))
  )
  WITH CHECK (
    turf_id IS NOT NULL
    AND (private.is_turf_owner(turf_id) OR private.has_role(auth.uid(), 'admin'::public.app_role))
  );

-- 5) storage.objects (turf-images): fix join to use the storage object name,
--    not the turf's display name.
DROP POLICY IF EXISTS "Turf images owner delete" ON storage.objects;
DROP POLICY IF EXISTS "Turf images owner or admin read" ON storage.objects;
DROP POLICY IF EXISTS "Turf images owner update" ON storage.objects;
DROP POLICY IF EXISTS "Turf images owner upload" ON storage.objects;

CREATE POLICY "Turf images owner or admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'turf-images'
    AND (
      private.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.turfs t
        WHERE (t.id)::text = (storage.foldername(storage.objects.name))[1]
          AND t.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Turf images owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'turf-images'
    AND EXISTS (
      SELECT 1 FROM public.turfs t
      WHERE (t.id)::text = (storage.foldername(storage.objects.name))[1]
        AND (t.owner_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role))
    )
  );

CREATE POLICY "Turf images owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'turf-images'
    AND EXISTS (
      SELECT 1 FROM public.turfs t
      WHERE (t.id)::text = (storage.foldername(storage.objects.name))[1]
        AND (t.owner_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role))
    )
  );

CREATE POLICY "Turf images owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'turf-images'
    AND EXISTS (
      SELECT 1 FROM public.turfs t
      WHERE (t.id)::text = (storage.foldername(storage.objects.name))[1]
        AND (t.owner_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role))
    )
  );

-- 6) turfs.owner_id should not be enumerable by the public.
--    Revoke column-level SELECT on owner_id from anon/public; owners and admins
--    still see it through column grants to authenticated.
REVOKE SELECT ON public.turfs FROM anon, PUBLIC;
GRANT SELECT
  (id, name, slug, description, address, city, state, country, lat, lng,
   cover_image_url, base_price, rating, total_reviews, status, rules,
   is_featured, created_at, updated_at, cancellation_hours,
   cancellation_fee_pct, reschedule_hours)
  ON public.turfs TO anon;
-- authenticated keeps full SELECT (needed for owners/admins viewing their own rows).
GRANT SELECT ON public.turfs TO authenticated;
