
CREATE TABLE public.squad_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.squad_fill_requests(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.squad_fill_posts(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX squad_request_events_request_idx ON public.squad_request_events(request_id, created_at);
CREATE INDEX squad_request_events_post_idx ON public.squad_request_events(post_id, created_at);

GRANT SELECT ON public.squad_request_events TO authenticated;
GRANT ALL ON public.squad_request_events TO service_role;

ALTER TABLE public.squad_request_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host or requester can view events"
  ON public.squad_request_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_fill_requests r
      JOIN public.squad_fill_posts p ON p.id = r.post_id
      WHERE r.id = squad_request_events.request_id
        AND (r.user_id = auth.uid() OR p.host_id = auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.log_squad_request_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.squad_request_events(request_id, post_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, NEW.post_id, NULL, NEW.status, auth.uid(), 'Request created');
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.squad_request_events(request_id, post_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NEW.post_id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS squad_request_events_trg ON public.squad_fill_requests;
CREATE TRIGGER squad_request_events_trg
  AFTER INSERT OR UPDATE ON public.squad_fill_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_squad_request_event();

ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_request_events;
