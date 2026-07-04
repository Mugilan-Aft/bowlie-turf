
-- Add payment_method to bookings + allow player to set it via guard bypass on payment_method column only
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_method text;

-- Confirm booking RPC: player picks payment method → booking becomes confirmed.
-- For 'netbanking' we simulate paid; for 'cash' we mark unpaid (pay at venue).
CREATE OR REPLACE FUNCTION public.confirm_booking_payment(_booking_id uuid, _method text)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  b public.bookings;
  new_payment public.payment_status;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501'; END IF;
  IF _method NOT IN ('netbanking','cash') THEN
    RAISE EXCEPTION 'Invalid payment method' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO b FROM public.bookings WHERE id = _booking_id;
  IF b IS NULL THEN RAISE EXCEPTION 'Booking not found' USING ERRCODE = '23503'; END IF;
  IF b.user_id <> caller THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501'; END IF;
  IF b.status <> 'pending' THEN RAISE EXCEPTION 'Booking is % — cannot confirm', b.status USING ERRCODE = '22023'; END IF;

  new_payment := CASE WHEN _method = 'netbanking' THEN 'paid'::public.payment_status
                      ELSE 'unpaid'::public.payment_status END;

  UPDATE public.bookings
     SET status = 'confirmed'::public.booking_status,
         payment_status = new_payment,
         payment_method = _method,
         lock_expires_at = NULL
   WHERE id = _booking_id
   RETURNING * INTO b;
  RETURN b;
END $$;

REVOKE ALL ON FUNCTION public.confirm_booking_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_booking_payment(uuid, text) TO authenticated;

-- Mark_completed helper for reviews: any authorized viewer with an ended booking can flip it
CREATE OR REPLACE FUNCTION public.mark_booking_completed(_booking_id uuid)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  b public.bookings;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO b FROM public.bookings WHERE id = _booking_id;
  IF b IS NULL THEN RAISE EXCEPTION 'Booking not found' USING ERRCODE = '23503'; END IF;
  IF NOT (b.user_id = caller OR private.is_turf_owner(b.turf_id) OR private.has_role(caller, 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF b.status = 'completed' THEN RETURN b; END IF;
  IF b.status NOT IN ('confirmed','pending') THEN
    RAISE EXCEPTION 'Booking is % — cannot complete', b.status USING ERRCODE = '22023';
  END IF;
  IF b.end_at > now() THEN
    RAISE EXCEPTION 'Booking has not ended yet' USING ERRCODE = '22023';
  END IF;
  UPDATE public.bookings SET status = 'completed'::public.booking_status
   WHERE id = _booking_id RETURNING * INTO b;
  RETURN b;
END $$;

REVOKE ALL ON FUNCTION public.mark_booking_completed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_booking_completed(uuid) TO authenticated;
