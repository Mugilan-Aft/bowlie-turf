
-- 1. Add 'joined' to request status enum
ALTER TYPE public.squad_request_status ADD VALUE IF NOT EXISTS 'joined';

-- 2. Helper: prevent joining own post / closed post / past booking; auto-handle instant_join; bump spots_filled
CREATE OR REPLACE FUNCTION public.squad_request_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  post RECORD;
  booking_start timestamptz;
BEGIN
  SELECT p.*, b.start_at INTO post
  FROM public.squad_fill_posts p
  JOIN public.bookings b ON b.id = p.booking_id
  WHERE p.id = NEW.post_id;
  IF post IS NULL THEN
    RAISE EXCEPTION 'Squad post not found';
  END IF;
  booking_start := post.start_at;

  IF TG_OP = 'INSERT' THEN
    IF post.host_id = NEW.user_id THEN
      RAISE EXCEPTION 'Host cannot join their own squad post';
    END IF;
    IF post.status <> 'open' THEN
      RAISE EXCEPTION 'Squad post is not open';
    END IF;
    IF booking_start <= now() THEN
      RAISE EXCEPTION 'Squad post booking has already started';
    END IF;
    IF post.approval_mode = 'instant_join' THEN
      IF post.spots_filled >= post.spots_needed THEN
        RAISE EXCEPTION 'No spots left';
      END IF;
      NEW.status := 'joined';
    ELSE
      NEW.status := COALESCE(NEW.status, 'pending');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.squad_request_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_squad_req_guard ON public.squad_fill_requests;
CREATE TRIGGER trg_squad_req_guard
BEFORE INSERT OR UPDATE OF status ON public.squad_fill_requests
FOR EACH ROW EXECUTE FUNCTION public.squad_request_guard();

-- 3. After-write: keep post.spots_filled and status in sync
CREATE OR REPLACE FUNCTION public.squad_post_sync_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pid uuid;
  joined_count int;
  needed int;
BEGIN
  pid := COALESCE(NEW.post_id, OLD.post_id);
  SELECT spots_needed INTO needed FROM public.squad_fill_posts WHERE id = pid;
  SELECT COUNT(*) INTO joined_count FROM public.squad_fill_requests WHERE post_id = pid AND status = 'joined';
  UPDATE public.squad_fill_posts
  SET spots_filled = joined_count,
      status = CASE
        WHEN status IN ('closed', 'expired') THEN status
        WHEN joined_count >= needed THEN 'full'
        ELSE 'open'
      END
  WHERE id = pid;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.squad_post_sync_counts() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_squad_post_sync ON public.squad_fill_requests;
CREATE TRIGGER trg_squad_post_sync
AFTER INSERT OR UPDATE OF status OR DELETE ON public.squad_fill_requests
FOR EACH ROW EXECUTE FUNCTION public.squad_post_sync_counts();

-- 4. Auto-set emergency_expires_at on insert/update of emergency posts
CREATE OR REPLACE FUNCTION public.squad_post_set_emergency_expiry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  start_at timestamptz;
BEGIN
  IF NEW.fill_type = 'emergency' THEN
    SELECT b.start_at INTO start_at FROM public.bookings b WHERE b.id = NEW.booking_id;
    IF start_at IS NOT NULL THEN
      NEW.emergency_expires_at := start_at + interval '10 minutes';
    END IF;
  ELSE
    NEW.emergency_expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.squad_post_set_emergency_expiry() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_squad_post_emergency_expiry ON public.squad_fill_posts;
CREATE TRIGGER trg_squad_post_emergency_expiry
BEFORE INSERT OR UPDATE OF fill_type, booking_id ON public.squad_fill_posts
FOR EACH ROW EXECUTE FUNCTION public.squad_post_set_emergency_expiry();

-- 5. Pure SQL cleanup: close emergency posts past expiry; expire any open post whose booking has started
CREATE OR REPLACE FUNCTION public.squad_post_expire_due()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.squad_fill_posts p
  SET status = 'expired'
  WHERE p.status IN ('open', 'full')
    AND (
      (p.fill_type = 'emergency' AND p.emergency_expires_at IS NOT NULL AND p.emergency_expires_at <= now())
      OR EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = p.booking_id AND b.start_at + interval '10 minutes' <= now()
      )
    );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.squad_post_expire_due() FROM PUBLIC, anon, authenticated;

-- 6. Schedule per-minute cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN
  PERFORM cron.unschedule('squad-fill-expire');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('squad-fill-expire', '* * * * *', $$ SELECT public.squad_post_expire_due(); $$);
