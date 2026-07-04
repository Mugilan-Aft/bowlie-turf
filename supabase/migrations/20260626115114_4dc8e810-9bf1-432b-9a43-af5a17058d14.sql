
CREATE OR REPLACE FUNCTION public.get_booked_slots(_turf_id uuid, _day date)
RETURNS TABLE (start_at timestamptz, end_at timestamptz, pitch_type_id uuid, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.start_at, b.end_at, b.pitch_type_id, b.status::text
  FROM public.bookings b
  WHERE b.turf_id = _turf_id
    AND b.start_at >= (_day::timestamp)::timestamptz
    AND b.start_at <  ((_day + 1)::timestamp)::timestamptz
    AND (
      b.status IN ('confirmed','completed')
      OR (b.status = 'pending'
          AND COALESCE(b.lock_expires_at, b.created_at + interval '10 minutes') > now())
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_booked_slots(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(uuid, date) TO authenticated;
