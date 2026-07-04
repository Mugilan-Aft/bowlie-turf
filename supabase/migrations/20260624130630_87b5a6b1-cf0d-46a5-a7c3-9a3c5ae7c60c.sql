ALTER TABLE public.turfs
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS verification_checklist jsonb NOT NULL DEFAULT '[
    {"key":"photos","label":"Photos are clear and representative","ok":false},
    {"key":"address","label":"Address and map location verified","ok":false},
    {"key":"pricing","label":"Pricing and slot rules are clear","ok":false},
    {"key":"amenities","label":"Listed amenities match reality","ok":false},
    {"key":"owner_identity","label":"Owner identity confirmed","ok":false},
    {"key":"safety","label":"Safety and compliance acceptable","ok":false}
  ]'::jsonb,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);