
-- =========================================================
-- 1) Banned-user helper
-- =========================================================
CREATE OR REPLACE FUNCTION private.is_banned(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_banned FROM public.profiles WHERE id = _user_id), false)
$$;

-- =========================================================
-- 2) Booking price validation trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.validate_booking_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unit_price numeric;
  hours numeric;
  expected_subtotal numeric;
BEGIN
  -- Admins and turf owners bypass (they create offline/manual bookings)
  IF private.has_role(auth.uid(), 'admin'::public.app_role) OR private.is_turf_owner(NEW.turf_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.end_at <= NEW.start_at THEN
    RAISE EXCEPTION 'Invalid booking duration' USING ERRCODE = '22023';
  END IF;

  hours := EXTRACT(EPOCH FROM (NEW.end_at - NEW.start_at)) / 3600.0;

  IF NEW.pitch_type_id IS NOT NULL THEN
    SELECT base_price INTO unit_price FROM public.pitch_types
      WHERE id = NEW.pitch_type_id AND turf_id = NEW.turf_id;
  END IF;
  IF unit_price IS NULL THEN
    SELECT base_price INTO unit_price FROM public.turfs WHERE id = NEW.turf_id;
  END IF;
  IF unit_price IS NULL THEN
    RAISE EXCEPTION 'Turf pricing not found' USING ERRCODE = '23514';
  END IF;

  expected_subtotal := unit_price * hours;

  -- Allow small rounding tolerance (1 cent / paisa)
  IF COALESCE(NEW.subtotal_amount, 0) < expected_subtotal - 0.01 THEN
    RAISE EXCEPTION 'Booking subtotal % is below expected minimum %', NEW.subtotal_amount, expected_subtotal
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE(NEW.add_ons_amount, 0) < 0 THEN
    RAISE EXCEPTION 'Add-on amount cannot be negative' USING ERRCODE = '23514';
  END IF;

  IF COALESCE(NEW.total_amount, 0) < COALESCE(NEW.subtotal_amount, 0) + COALESCE(NEW.add_ons_amount, 0) - 0.01 THEN
    RAISE EXCEPTION 'Booking total % does not match subtotal + add-ons', NEW.total_amount
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_booking_pricing_trg ON public.bookings;
CREATE TRIGGER validate_booking_pricing_trg
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_booking_pricing();

-- =========================================================
-- 3) Booking add-on price validation trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.validate_booking_add_on_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  configured_price numeric;
  booking_turf uuid;
  add_on_turf uuid;
  caller uuid := auth.uid();
  booking_owner uuid;
BEGIN
  SELECT turf_id, user_id INTO booking_turf, booking_owner FROM public.bookings WHERE id = NEW.booking_id;
  IF booking_turf IS NULL THEN
    RAISE EXCEPTION 'Booking not found' USING ERRCODE = '23503';
  END IF;

  -- Admins and turf owners bypass
  IF private.has_role(caller, 'admin'::public.app_role) OR private.is_turf_owner(booking_turf) THEN
    RETURN NEW;
  END IF;

  SELECT price, turf_id INTO configured_price, add_on_turf
    FROM public.add_on_services WHERE id = NEW.add_on_id;
  IF configured_price IS NULL THEN
    RAISE EXCEPTION 'Add-on not found' USING ERRCODE = '23503';
  END IF;
  IF add_on_turf IS DISTINCT FROM booking_turf THEN
    RAISE EXCEPTION 'Add-on does not belong to booking turf' USING ERRCODE = '23514';
  END IF;
  IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'Add-on quantity must be positive' USING ERRCODE = '23514';
  END IF;
  IF ABS(COALESCE(NEW.unit_price, 0) - configured_price) > 0.01 THEN
    RAISE EXCEPTION 'Add-on unit price % does not match configured price %', NEW.unit_price, configured_price
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_booking_add_on_price_trg ON public.booking_add_ons;
CREATE TRIGGER validate_booking_add_on_price_trg
  BEFORE INSERT ON public.booking_add_ons
  FOR EACH ROW EXECUTE FUNCTION public.validate_booking_add_on_price();

-- =========================================================
-- 4) Enforce ban flag on write-side policies
-- =========================================================
DROP POLICY IF EXISTS "Users or owners create bookings" ON public.bookings;
CREATE POLICY "Users or owners create bookings"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (
    NOT private.is_banned(auth.uid())
    AND (
      (auth.uid() = user_id)
      OR ((is_offline = true) AND private.is_turf_owner(turf_id))
    )
  );

DROP POLICY IF EXISTS "Squad reqs self insert" ON public.squad_fill_requests;
CREATE POLICY "Squad reqs self insert"
  ON public.squad_fill_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT private.is_banned(auth.uid()));

DROP POLICY IF EXISTS "Regs self insert" ON public.tournament_registrations;
CREATE POLICY "Regs self insert"
  ON public.tournament_registrations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT private.is_banned(auth.uid()));
