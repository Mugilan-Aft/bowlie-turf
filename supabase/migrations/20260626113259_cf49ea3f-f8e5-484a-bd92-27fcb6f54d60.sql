
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_in_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_booking ON public.reviews(booking_id);

-- Extend guard_booking_update to allow player/owner/admin to set checked_in_at without tripping the financial-field guard.
-- (No change needed — checked_in_at is not in the guarded list. Players currently can only flip status to 'cancelled' though;
--  set checked_in_at via a SECURITY DEFINER RPC instead so we don't have to relax the status guard.)

CREATE OR REPLACE FUNCTION public.check_in_booking(_booking_id uuid)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  b public.bookings;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Sign in to verify' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO b FROM public.bookings WHERE id = _booking_id;
  IF b IS NULL THEN
    RAISE EXCEPTION 'Booking not found' USING ERRCODE = '23503';
  END IF;
  IF NOT (
    b.user_id = caller
    OR private.is_turf_owner(b.turf_id)
    OR private.has_role(caller, 'admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Not allowed to verify this booking' USING ERRCODE = '42501';
  END IF;
  IF b.status NOT IN ('pending', 'confirmed', 'completed') THEN
    RAISE EXCEPTION 'Booking is %, cannot check in', b.status USING ERRCODE = '22023';
  END IF;
  IF b.checked_in_at IS NULL THEN
    UPDATE public.bookings
      SET checked_in_at = now(), checked_in_by = caller
      WHERE id = _booking_id
      RETURNING * INTO b;
  END IF;
  RETURN b;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in_booking(uuid) TO authenticated;
