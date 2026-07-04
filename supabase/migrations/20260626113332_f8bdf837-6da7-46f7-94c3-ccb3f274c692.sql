REVOKE EXECUTE ON FUNCTION public.check_in_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_booking(uuid) TO authenticated;