
CREATE TABLE public.tournament_fixtures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round smallint NOT NULL,
  position smallint NOT NULL,
  team_a_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  team_b_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  score_a smallint,
  score_b smallint,
  winner_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, round, position)
);

GRANT SELECT ON public.tournament_fixtures TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_fixtures TO authenticated;
GRANT ALL ON public.tournament_fixtures TO service_role;

ALTER TABLE public.tournament_fixtures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view fixtures"
  ON public.tournament_fixtures FOR SELECT
  USING (true);

CREATE POLICY "Tournament owner manages fixtures"
  ON public.tournament_fixtures FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER trg_tournament_fixtures_updated
  BEFORE UPDATE ON public.tournament_fixtures
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
