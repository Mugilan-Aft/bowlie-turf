CREATE OR REPLACE FUNCTION public.get_tournament_capacity(_tournament_id uuid)
RETURNS TABLE(approved_count integer, max_teams integer, is_full boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT COUNT(*)::int FROM public.tournament_registrations r
              WHERE r.tournament_id = _tournament_id AND r.status = 'approved'), 0) AS approved_count,
    t.max_teams,
    CASE WHEN t.max_teams IS NULL THEN false
         ELSE COALESCE((SELECT COUNT(*) FROM public.tournament_registrations r
                        WHERE r.tournament_id = _tournament_id AND r.status = 'approved'), 0) >= t.max_teams
    END AS is_full
  FROM public.tournaments t
  WHERE t.id = _tournament_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_tournament_capacity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tournament_capacity(uuid) TO anon, authenticated;