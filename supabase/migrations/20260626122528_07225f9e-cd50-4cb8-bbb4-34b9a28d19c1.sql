
-- Public RPCs to expose minimal booking/turf info for squad fill posts
-- (bookings table is private under RLS; squad posts need start time + venue
-- to render to non-owner visitors).

CREATE OR REPLACE FUNCTION public.get_open_squad_posts()
RETURNS TABLE (
  id uuid,
  host_id uuid,
  booking_id uuid,
  sport_id uuid,
  fill_type text,
  approval_mode text,
  skill_level text,
  spots_needed int,
  spots_filled int,
  join_fee numeric,
  notes text,
  status text,
  emergency_expires_at timestamptz,
  created_at timestamptz,
  start_at timestamptz,
  end_at timestamptz,
  turf_id uuid,
  turf_name text,
  turf_city text,
  turf_slug text,
  turf_cover_image_url text,
  sport_name text,
  host_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.id, p.host_id, p.booking_id, p.sport_id,
    p.fill_type::text, p.approval_mode::text, p.skill_level::text,
    p.spots_needed, p.spots_filled, p.join_fee, p.notes, p.status::text,
    p.emergency_expires_at, p.created_at,
    b.start_at, b.end_at,
    t.id, t.name, t.city, t.slug, t.cover_image_url,
    s.name,
    pr.full_name
  FROM public.squad_fill_posts p
  LEFT JOIN public.bookings b ON b.id = p.booking_id
  LEFT JOIN public.turfs t ON t.id = b.turf_id
  LEFT JOIN public.sports s ON s.id = p.sport_id
  LEFT JOIN public.profiles pr ON pr.id = p.host_id
  WHERE p.status = 'open'
    AND (b.start_at IS NULL OR b.start_at > now());
$$;

REVOKE ALL ON FUNCTION public.get_open_squad_posts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_open_squad_posts() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_squad_post(_id uuid)
RETURNS TABLE (
  id uuid,
  host_id uuid,
  booking_id uuid,
  sport_id uuid,
  fill_type text,
  approval_mode text,
  skill_level text,
  spots_needed int,
  spots_filled int,
  join_fee numeric,
  notes text,
  status text,
  emergency_expires_at timestamptz,
  created_at timestamptz,
  start_at timestamptz,
  end_at timestamptz,
  turf_id uuid,
  turf_name text,
  turf_city text,
  turf_slug text,
  turf_address text,
  turf_cover_image_url text,
  sport_name text,
  host_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.id, p.host_id, p.booking_id, p.sport_id,
    p.fill_type::text, p.approval_mode::text, p.skill_level::text,
    p.spots_needed, p.spots_filled, p.join_fee, p.notes, p.status::text,
    p.emergency_expires_at, p.created_at,
    b.start_at, b.end_at,
    t.id, t.name, t.city, t.slug, t.address, t.cover_image_url,
    s.name,
    pr.full_name
  FROM public.squad_fill_posts p
  LEFT JOIN public.bookings b ON b.id = p.booking_id
  LEFT JOIN public.turfs t ON t.id = b.turf_id
  LEFT JOIN public.sports s ON s.id = p.sport_id
  LEFT JOIN public.profiles pr ON pr.id = p.host_id
  WHERE p.id = _id;
$$;

REVOKE ALL ON FUNCTION public.get_squad_post(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_squad_post(uuid) TO anon, authenticated;
