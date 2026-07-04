
CREATE TABLE public.fixture_score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id uuid NOT NULL REFERENCES public.tournament_fixtures(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  score_a smallint,
  score_b smallint,
  status text,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fixture_score_events_fixture_idx ON public.fixture_score_events(fixture_id, created_at DESC);

GRANT SELECT ON public.fixture_score_events TO anon;
GRANT SELECT, INSERT ON public.fixture_score_events TO authenticated;
GRANT ALL ON public.fixture_score_events TO service_role;

ALTER TABLE public.fixture_score_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view score events"
  ON public.fixture_score_events FOR SELECT USING (true);

CREATE POLICY "Tournament owner records score events"
  ON public.fixture_score_events FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND (
      EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.owner_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_fixtures;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fixture_score_events;
ALTER TABLE public.tournament_fixtures REPLICA IDENTITY FULL;
