
-- ============ TURFS: prevent owners from self-approving ============
CREATE OR REPLACE FUNCTION public.guard_turf_approval_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
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
END $$;

DROP TRIGGER IF EXISTS turfs_guard_approval ON public.turfs;
CREATE TRIGGER turfs_guard_approval
BEFORE UPDATE ON public.turfs
FOR EACH ROW EXECUTE FUNCTION public.guard_turf_approval_fields();

-- ============ BOOKINGS: split player vs owner/admin update rights ============
CREATE OR REPLACE FUNCTION public.guard_booking_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin');
  is_owner boolean := public.is_turf_owner(NEW.turf_id);
  is_player boolean := auth.uid() = OLD.user_id;
BEGIN
  IF is_admin OR is_owner THEN
    RETURN NEW;
  END IF;
  IF NOT is_player THEN
    RAISE EXCEPTION 'Not allowed to modify this booking' USING ERRCODE = '42501';
  END IF;
  -- Player path: only allow self-cancel, no payment/financial edits
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
END $$;

DROP TRIGGER IF EXISTS bookings_guard_update ON public.bookings;
CREATE TRIGGER bookings_guard_update
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.guard_booking_update();

-- ============ TOURNAMENTS: require owner/admin role on create ============
DROP POLICY IF EXISTS "Owners manage tournaments" ON public.tournaments;
CREATE POLICY "Owners manage tournaments" ON public.tournaments
FOR ALL TO authenticated
USING ((auth.uid() = owner_id) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (
  (auth.uid() = owner_id AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')))
  OR public.has_role(auth.uid(), 'admin')
);

-- ============ USER_ROLES: admins manage all role grants ============
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can revoke own owner role" ON public.user_roles;
CREATE POLICY "Users can revoke own owner role" ON public.user_roles
FOR DELETE TO authenticated
USING (auth.uid() = user_id AND role = 'owner');
