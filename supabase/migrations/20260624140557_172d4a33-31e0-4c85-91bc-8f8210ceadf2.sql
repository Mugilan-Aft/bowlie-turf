
-- 1. Move SECURITY DEFINER helper functions out of the public API schema
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.is_turf_owner(uuid) SET SCHEMA private;

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_turf_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_turf_owner(uuid) TO anon, authenticated, service_role;

-- 2. Update plpgsql functions that reference the qualified public.has_role/is_turf_owner
CREATE OR REPLACE FUNCTION public.guard_turf_approval_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.reviewed_by IS NULL THEN
      NEW.reviewed_by := auth.uid();
      NEW.reviewed_at := now();
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     OR NEW.verification_checklist IS DISTINCT FROM OLD.verification_checklist
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by THEN
    RAISE EXCEPTION 'Only admins can modify verification fields' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.guard_booking_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean := private.has_role(auth.uid(), 'admin'::public.app_role);
  is_owner boolean := private.is_turf_owner(NEW.turf_id);
  is_player boolean := auth.uid() = OLD.user_id;
BEGIN
  IF is_admin OR is_owner THEN
    RETURN NEW;
  END IF;
  IF NOT is_player THEN
    RAISE EXCEPTION 'Not allowed to modify this booking' USING ERRCODE = '42501';
  END IF;
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.turf_id IS DISTINCT FROM OLD.turf_id
     OR NEW.pitch_type_id IS DISTINCT FROM OLD.pitch_type_id
     OR NEW.start_at IS DISTINCT FROM OLD.start_at
     OR NEW.end_at IS DISTINCT FROM OLD.end_at
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Players cannot modify financial or scheduling fields' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Players can only cancel their own bookings' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;

-- 3. Profiles: scoped SELECT + safe public view
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins view all profiles"
  ON public.profiles FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = off) AS
SELECT id, full_name, avatar_url, city, created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 4. Storage: restrict turf-images raw object read (public viewing still works via signed URLs)
DROP POLICY IF EXISTS "Turf images authenticated read" ON storage.objects;

CREATE POLICY "Turf images owner or admin read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'turf-images'
    AND (
      private.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.turfs t
        WHERE t.id::text = (storage.foldername(name))[1]
          AND t.owner_id = auth.uid()
      )
    )
  );

-- 5. user_roles: remove client-side self-assign of owner role
DROP POLICY IF EXISTS "Users can self-assign owner role" ON public.user_roles;
