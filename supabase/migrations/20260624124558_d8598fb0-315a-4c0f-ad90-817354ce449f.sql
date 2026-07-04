
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS offline_customer_name text,
  ADD COLUMN IF NOT EXISTS offline_customer_phone text;

DROP POLICY IF EXISTS "Users create own bookings" ON public.bookings;
CREATE POLICY "Users or owners create bookings"
ON public.bookings FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR (is_offline = true AND public.is_turf_owner(turf_id))
);

DROP POLICY IF EXISTS "Live matches owner manage" ON public.live_matches;
CREATE POLICY "Live matches owner manage"
ON public.live_matches FOR ALL
USING (
  public.is_turf_owner(turf_id)
  OR public.has_role(auth.uid(),'admin')
)
WITH CHECK (
  public.is_turf_owner(turf_id)
  OR public.has_role(auth.uid(),'admin')
);
