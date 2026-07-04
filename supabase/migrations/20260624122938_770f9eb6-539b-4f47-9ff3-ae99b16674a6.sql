
REVOKE EXECUTE ON FUNCTION public.log_booking_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_booking_overlap() FROM PUBLIC, anon, authenticated;
