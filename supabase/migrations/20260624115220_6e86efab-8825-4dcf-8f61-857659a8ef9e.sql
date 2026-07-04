
-- =========================================================
-- Enums
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('player', 'owner', 'admin');
CREATE TYPE public.turf_status AS ENUM ('pending', 'approved', 'suspended', 'rejected');
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'refunded');
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'pending', 'paid', 'refunded', 'failed');
CREATE TYPE public.payment_provider AS ENUM ('manual', 'stripe', 'razorpay', 'paypal');
CREATE TYPE public.skill_level AS ENUM ('beginner', 'intermediate', 'advanced', 'pro', 'any');
CREATE TYPE public.approval_mode AS ENUM ('host_approval', 'instant_join');
CREATE TYPE public.squad_fill_type AS ENUM ('pre_match', 'emergency');
CREATE TYPE public.squad_post_status AS ENUM ('open', 'full', 'closed', 'expired');
CREATE TYPE public.squad_request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE public.tournament_status AS ENUM ('draft', 'open', 'closed', 'live', 'completed', 'cancelled');
CREATE TYPE public.match_status AS ENUM ('scheduled', 'live', 'completed', 'cancelled');
CREATE TYPE public.notification_type AS ENUM ('booking', 'squad_fill', 'tournament', 'system', 'review');
CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- =========================================================
-- Profiles
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  city TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- =========================================================
-- User roles
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Admin-managed role view policy
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- New user trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  desired_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'phone');

  desired_role := COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'player');
  IF desired_role = 'admin' THEN
    desired_role := 'player'; -- admins must be assigned manually
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, desired_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- updated_at helper
-- =========================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- Catalog: sports + amenities
-- =========================================================
CREATE TABLE public.sports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sports TO anon, authenticated;
GRANT ALL ON public.sports TO service_role;
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sports public read" ON public.sports FOR SELECT USING (true);
CREATE POLICY "Admins manage sports" ON public.sports FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.amenities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.amenities TO anon, authenticated;
GRANT ALL ON public.amenities TO service_role;
ALTER TABLE public.amenities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Amenities public read" ON public.amenities FOR SELECT USING (true);
CREATE POLICY "Admins manage amenities" ON public.amenities FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- Turfs
-- =========================================================
CREATE TABLE public.turfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'India',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  cover_image_url TEXT,
  base_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  rating NUMERIC(2,1) NOT NULL DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  status public.turf_status NOT NULL DEFAULT 'pending',
  rules TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_turfs_city ON public.turfs(city);
CREATE INDEX idx_turfs_status ON public.turfs(status);
CREATE INDEX idx_turfs_owner ON public.turfs(owner_id);
GRANT SELECT ON public.turfs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.turfs TO authenticated;
GRANT ALL ON public.turfs TO service_role;
ALTER TABLE public.turfs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved turfs public read" ON public.turfs FOR SELECT USING (status = 'approved' OR auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners insert own turfs" ON public.turfs FOR INSERT WITH CHECK (auth.uid() = owner_id AND public.has_role(auth.uid(),'owner'));
CREATE POLICY "Owners update own turfs" ON public.turfs FOR UPDATE USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners delete own turfs" ON public.turfs FOR DELETE USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_turfs_updated BEFORE UPDATE ON public.turfs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helper: is current user the owner of given turf
CREATE OR REPLACE FUNCTION public.is_turf_owner(_turf_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.turfs WHERE id = _turf_id AND owner_id = auth.uid())
$$;

-- =========================================================
-- Turf images
-- =========================================================
CREATE TABLE public.turf_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turf_id UUID NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.turf_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.turf_images TO authenticated;
GRANT ALL ON public.turf_images TO service_role;
ALTER TABLE public.turf_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Turf images public read" ON public.turf_images FOR SELECT USING (true);
CREATE POLICY "Owners manage own turf images" ON public.turf_images FOR ALL USING (public.is_turf_owner(turf_id) OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.is_turf_owner(turf_id) OR public.has_role(auth.uid(),'admin'));

-- =========================================================
-- Turf sports / amenities
-- =========================================================
CREATE TABLE public.turf_sports (
  turf_id UUID NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  PRIMARY KEY (turf_id, sport_id)
);
GRANT SELECT ON public.turf_sports TO anon, authenticated;
GRANT INSERT, DELETE ON public.turf_sports TO authenticated;
GRANT ALL ON public.turf_sports TO service_role;
ALTER TABLE public.turf_sports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Turf sports public read" ON public.turf_sports FOR SELECT USING (true);
CREATE POLICY "Owners manage own turf sports" ON public.turf_sports FOR ALL USING (public.is_turf_owner(turf_id) OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.is_turf_owner(turf_id) OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.turf_amenities (
  turf_id UUID NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,
  amenity_id UUID NOT NULL REFERENCES public.amenities(id) ON DELETE CASCADE,
  PRIMARY KEY (turf_id, amenity_id)
);
GRANT SELECT ON public.turf_amenities TO anon, authenticated;
GRANT INSERT, DELETE ON public.turf_amenities TO authenticated;
GRANT ALL ON public.turf_amenities TO service_role;
ALTER TABLE public.turf_amenities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Turf amenities public read" ON public.turf_amenities FOR SELECT USING (true);
CREATE POLICY "Owners manage own turf amenities" ON public.turf_amenities FOR ALL USING (public.is_turf_owner(turf_id) OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.is_turf_owner(turf_id) OR public.has_role(auth.uid(),'admin'));

-- =========================================================
-- Pitch types
-- =========================================================
CREATE TABLE public.pitch_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turf_id UUID NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  surface_type TEXT,
  capacity INTEGER,
  base_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pitch_types TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pitch_types TO authenticated;
GRANT ALL ON public.pitch_types TO service_role;
ALTER TABLE public.pitch_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pitch types public read" ON public.pitch_types FOR SELECT USING (true);
CREATE POLICY "Owners manage own pitch types" ON public.pitch_types FOR ALL USING (public.is_turf_owner(turf_id) OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.is_turf_owner(turf_id) OR public.has_role(auth.uid(),'admin'));

-- =========================================================
-- Add-on services
-- =========================================================
CREATE TABLE public.add_on_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turf_id UUID NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'per_hour',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.add_on_services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.add_on_services TO authenticated;
GRANT ALL ON public.add_on_services TO service_role;
ALTER TABLE public.add_on_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Add-ons public read" ON public.add_on_services FOR SELECT USING (true);
CREATE POLICY "Owners manage own add-ons" ON public.add_on_services FOR ALL USING (public.is_turf_owner(turf_id) OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.is_turf_owner(turf_id) OR public.has_role(auth.uid(),'admin'));

-- =========================================================
-- Availability slots (recurring template)
-- =========================================================
CREATE TABLE public.availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turf_id UUID NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,
  pitch_type_id UUID REFERENCES public.pitch_types(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  is_peak BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_slots_turf_day ON public.availability_slots(turf_id, day_of_week);
GRANT SELECT ON public.availability_slots TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.availability_slots TO authenticated;
GRANT ALL ON public.availability_slots TO service_role;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Slots public read" ON public.availability_slots FOR SELECT USING (true);
CREATE POLICY "Owners manage own slots" ON public.availability_slots FOR ALL USING (public.is_turf_owner(turf_id) OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.is_turf_owner(turf_id) OR public.has_role(auth.uid(),'admin'));

-- =========================================================
-- Blackout periods
-- =========================================================
CREATE TABLE public.blackout_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turf_id UUID NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,
  pitch_type_id UUID REFERENCES public.pitch_types(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blackout_periods TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blackout_periods TO authenticated;
GRANT ALL ON public.blackout_periods TO service_role;
ALTER TABLE public.blackout_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Blackouts public read" ON public.blackout_periods FOR SELECT USING (true);
CREATE POLICY "Owners manage own blackouts" ON public.blackout_periods FOR ALL USING (public.is_turf_owner(turf_id) OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.is_turf_owner(turf_id) OR public.has_role(auth.uid(),'admin'));

-- =========================================================
-- Bookings
-- =========================================================
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turf_id UUID NOT NULL REFERENCES public.turfs(id) ON DELETE RESTRICT,
  pitch_type_id UUID REFERENCES public.pitch_types(id) ON DELETE SET NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  status public.booking_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  lock_expires_at TIMESTAMPTZ,
  notes TEXT,
  is_offline BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bookings_user ON public.bookings(user_id);
CREATE INDEX idx_bookings_turf_start ON public.bookings(turf_id, start_at);
GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own bookings" ON public.bookings FOR SELECT USING (auth.uid() = user_id OR public.is_turf_owner(turf_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own bookings" ON public.bookings FOR UPDATE USING (auth.uid() = user_id OR public.is_turf_owner(turf_id) OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- Booking participants & add-ons
-- =========================================================
CREATE TABLE public.booking_participants (
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'player',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.booking_participants TO authenticated;
GRANT ALL ON public.booking_participants TO service_role;
ALTER TABLE public.booking_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view" ON public.booking_participants FOR SELECT USING (
  auth.uid() = user_id OR EXISTS(SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND (b.user_id = auth.uid() OR public.is_turf_owner(b.turf_id))) OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "Participants self insert" ON public.booking_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Participants self delete" ON public.booking_participants FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.booking_add_ons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  add_on_id UUID NOT NULL REFERENCES public.add_on_services(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL
);
GRANT SELECT, INSERT, DELETE ON public.booking_add_ons TO authenticated;
GRANT ALL ON public.booking_add_ons TO service_role;
ALTER TABLE public.booking_add_ons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Booking add-ons access" ON public.booking_add_ons FOR ALL USING (
  EXISTS(SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND (b.user_id = auth.uid() OR public.is_turf_owner(b.turf_id))) OR public.has_role(auth.uid(),'admin')
) WITH CHECK (
  EXISTS(SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
);

-- =========================================================
-- Payments
-- =========================================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  provider public.payment_provider NOT NULL DEFAULT 'manual',
  provider_ref TEXT,
  status public.payment_status NOT NULL DEFAULT 'pending',
  owner_payout_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payments access" ON public.payments FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND (b.user_id = auth.uid() OR public.is_turf_owner(b.turf_id))) OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "Payments insert own" ON public.payments FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
);

-- =========================================================
-- Teams + tournaments
-- =========================================================
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  captain_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teams TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teams public read" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Captains manage teams" ON public.teams FOR ALL USING (auth.uid() = captain_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = captain_id);

CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turf_id UUID NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  format TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  entry_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_teams INTEGER,
  banner_url TEXT,
  status public.tournament_status NOT NULL DEFAULT 'draft',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tournaments_status ON public.tournaments(status);
GRANT SELECT ON public.tournaments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tournaments TO authenticated;
GRANT ALL ON public.tournaments TO service_role;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tournaments public read" ON public.tournaments FOR SELECT USING (status <> 'draft' OR auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners manage tournaments" ON public.tournaments FOR ALL USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.tournament_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_registrations TO authenticated;
GRANT ALL ON public.tournament_registrations TO service_role;
ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Regs view" ON public.tournament_registrations FOR SELECT USING (
  auth.uid() = user_id OR EXISTS(SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.owner_id = auth.uid()) OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "Regs self insert" ON public.tournament_registrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Regs self delete" ON public.tournament_registrations FOR DELETE USING (auth.uid() = user_id);

-- =========================================================
-- Squad fill
-- =========================================================
CREATE TABLE public.squad_fill_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL,
  spots_needed INTEGER NOT NULL CHECK (spots_needed > 0),
  spots_filled INTEGER NOT NULL DEFAULT 0,
  skill_level public.skill_level NOT NULL DEFAULT 'any',
  join_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  approval_mode public.approval_mode NOT NULL DEFAULT 'host_approval',
  fill_type public.squad_fill_type NOT NULL DEFAULT 'pre_match',
  emergency_expires_at TIMESTAMPTZ,
  notes TEXT,
  status public.squad_post_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_squad_status ON public.squad_fill_posts(status);
GRANT SELECT ON public.squad_fill_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.squad_fill_posts TO authenticated;
GRANT ALL ON public.squad_fill_posts TO service_role;
ALTER TABLE public.squad_fill_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Squad posts public read" ON public.squad_fill_posts FOR SELECT USING (true);
CREATE POLICY "Hosts manage squad posts" ON public.squad_fill_posts FOR ALL USING (auth.uid() = host_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = host_id);

CREATE TABLE public.squad_fill_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.squad_fill_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT,
  status public.squad_request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_fill_requests TO authenticated;
GRANT ALL ON public.squad_fill_requests TO service_role;
ALTER TABLE public.squad_fill_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Squad reqs view" ON public.squad_fill_requests FOR SELECT USING (
  auth.uid() = user_id OR EXISTS(SELECT 1 FROM public.squad_fill_posts p WHERE p.id = post_id AND p.host_id = auth.uid()) OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "Squad reqs self insert" ON public.squad_fill_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Squad reqs self update" ON public.squad_fill_requests FOR UPDATE USING (
  auth.uid() = user_id OR EXISTS(SELECT 1 FROM public.squad_fill_posts p WHERE p.id = post_id AND p.host_id = auth.uid())
);
CREATE POLICY "Squad reqs self delete" ON public.squad_fill_requests FOR DELETE USING (auth.uid() = user_id);

-- =========================================================
-- Live matches & scoring
-- =========================================================
CREATE TABLE public.live_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  turf_id UUID REFERENCES public.turfs(id) ON DELETE SET NULL,
  sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL,
  team_a TEXT NOT NULL,
  team_b TEXT NOT NULL,
  score_a INTEGER NOT NULL DEFAULT 0,
  score_b INTEGER NOT NULL DEFAULT 0,
  status public.match_status NOT NULL DEFAULT 'scheduled',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.live_matches TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.live_matches TO authenticated;
GRANT ALL ON public.live_matches TO service_role;
ALTER TABLE public.live_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches public read" ON public.live_matches FOR SELECT USING (true);
CREATE POLICY "Owners manage matches" ON public.live_matches FOR ALL USING (
  (turf_id IS NULL OR public.is_turf_owner(turf_id)) OR public.has_role(auth.uid(),'admin')
) WITH CHECK (
  (turf_id IS NULL OR public.is_turf_owner(turf_id)) OR public.has_role(auth.uid(),'admin')
);

CREATE TABLE public.live_score_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.live_matches(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.live_score_events TO anon, authenticated;
GRANT INSERT ON public.live_score_events TO authenticated;
GRANT ALL ON public.live_score_events TO service_role;
ALTER TABLE public.live_score_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Score events public read" ON public.live_score_events FOR SELECT USING (true);
CREATE POLICY "Owners write score events" ON public.live_score_events FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.live_matches m WHERE m.id = match_id AND (m.turf_id IS NULL OR public.is_turf_owner(m.turf_id))) OR public.has_role(auth.uid(),'admin')
);

-- =========================================================
-- Reviews
-- =========================================================
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turf_id UUID NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id, user_id)
);
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews public read" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Reviewers own write" ON public.reviews FOR ALL USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (
  auth.uid() = user_id AND EXISTS(
    SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid() AND b.status = 'completed'
  )
);

-- =========================================================
-- Favorites
-- =========================================================
CREATE TABLE public.favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turf_id UUID NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, turf_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Favs own" ON public.favorites FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- Notifications, announcements, tickets
-- =========================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notifs own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Notifs update own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Announcements public read" ON public.announcements FOR SELECT USING (is_active);
CREATE POLICY "Admins manage announcements" ON public.announcements FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tickets own" ON public.support_tickets FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Tickets self insert" ON public.support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tickets self/admin update" ON public.support_tickets FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- =========================================================
-- Seed sports & amenities
-- =========================================================
INSERT INTO public.sports (name, slug, icon) VALUES
  ('Football','football','⚽'),
  ('Cricket','cricket','🏏'),
  ('Box Cricket','box-cricket','🥎'),
  ('Badminton','badminton','🏸'),
  ('Tennis','tennis','🎾'),
  ('Basketball','basketball','🏀'),
  ('Volleyball','volleyball','🏐'),
  ('Pickleball','pickleball','🎾');

INSERT INTO public.amenities (name, slug, icon) VALUES
  ('Parking','parking','car'),
  ('Floodlights','floodlights','lightbulb'),
  ('Changing Room','changing-room','door-open'),
  ('Washroom','washroom','toilet'),
  ('Drinking Water','drinking-water','droplet'),
  ('Cafeteria','cafeteria','coffee'),
  ('Equipment Rental','equipment-rental','dumbbell'),
  ('First Aid','first-aid','heart-pulse'),
  ('CCTV','cctv','video'),
  ('Wi-Fi','wifi','wifi');
