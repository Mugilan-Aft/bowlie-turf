
ALTER TABLE public.turfs
  ADD COLUMN IF NOT EXISTS cancellation_hours integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS cancellation_fee_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reschedule_hours integer NOT NULL DEFAULT 6;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS subtotal_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS add_ons_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS rescheduled_from_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.booking_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  from_status booking_status,
  to_status booking_status NOT NULL,
  from_payment_status payment_status,
  to_payment_status payment_status,
  note text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_status_events_booking ON public.booking_status_events(booking_id, created_at DESC);

GRANT SELECT, INSERT ON public.booking_status_events TO authenticated;
GRANT ALL ON public.booking_status_events TO service_role;

ALTER TABLE public.booking_status_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Status events visible to booking parties" ON public.booking_status_events;
CREATE POLICY "Status events visible to booking parties" ON public.booking_status_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_status_events.booking_id
        AND (b.user_id = auth.uid() OR public.is_turf_owner(b.turf_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "Status events insert by booking parties" ON public.booking_status_events;
CREATE POLICY "Status events insert by booking parties" ON public.booking_status_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_status_events.booking_id
        AND (b.user_id = auth.uid() OR public.is_turf_owner(b.turf_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE OR REPLACE FUNCTION public.log_booking_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.booking_status_events(booking_id, from_status, to_status, from_payment_status, to_payment_status, changed_by, note)
    VALUES (NEW.id, NULL, NEW.status, NULL, NEW.payment_status, auth.uid(), 'Booking created');
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    INSERT INTO public.booking_status_events(booking_id, from_status, to_status, from_payment_status, to_payment_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, OLD.payment_status, NEW.payment_status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_status_log ON public.bookings;
CREATE TRIGGER trg_bookings_status_log
AFTER INSERT OR UPDATE OF status, payment_status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.log_booking_status_change();

CREATE OR REPLACE FUNCTION public.prevent_booking_overlap()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  conflict_id uuid;
BEGIN
  IF NEW.status NOT IN ('pending', 'confirmed', 'completed') THEN
    RETURN NEW;
  END IF;
  SELECT b.id INTO conflict_id
  FROM public.bookings b
  WHERE b.turf_id = NEW.turf_id
    AND b.id <> NEW.id
    AND (
      (NEW.pitch_type_id IS NULL AND b.pitch_type_id IS NULL)
      OR (NEW.pitch_type_id IS NOT NULL AND b.pitch_type_id = NEW.pitch_type_id)
    )
    AND b.start_at < NEW.end_at
    AND b.end_at > NEW.start_at
    AND (
      b.status IN ('confirmed', 'completed')
      OR (b.status = 'pending' AND COALESCE(b.lock_expires_at, b.created_at + interval '10 minutes') > now())
    )
  LIMIT 1;
  IF conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Slot is no longer available' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_no_overlap ON public.bookings;
CREATE TRIGGER trg_bookings_no_overlap
BEFORE INSERT OR UPDATE OF start_at, end_at, turf_id, pitch_type_id, status, lock_expires_at ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.prevent_booking_overlap();

DROP POLICY IF EXISTS "Turf images authenticated read" ON storage.objects;
CREATE POLICY "Turf images authenticated read" ON storage.objects
  FOR SELECT USING (bucket_id = 'turf-images');

DROP POLICY IF EXISTS "Turf images owner upload" ON storage.objects;
CREATE POLICY "Turf images owner upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'turf-images'
    AND EXISTS (
      SELECT 1 FROM public.turfs t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND (t.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "Turf images owner delete" ON storage.objects;
CREATE POLICY "Turf images owner delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'turf-images'
    AND EXISTS (
      SELECT 1 FROM public.turfs t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND (t.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "Turf images owner update" ON storage.objects;
CREATE POLICY "Turf images owner update" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'turf-images'
    AND EXISTS (
      SELECT 1 FROM public.turfs t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND (t.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );
