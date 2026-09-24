-- Public aggregate only: no contact data, claim identities, or private locations.
-- This view supports the existing SHARek Community provider cards and profiles.
CREATE OR REPLACE VIEW public.public_donor_impact WITH (security_barrier = true) AS
SELECT p.id AS user_id,
  COALESCE((SELECT SUM(fd.meals) FROM public.food_donations fd
    WHERE fd.user_id = p.id AND fd.status IN ('received', 'completed', 'rated')), 0)::bigint AS donated_meals,
  COALESCE((SELECT COUNT(DISTINCT fc.claimer_id)
    FROM public.food_donations fd
    JOIN public.food_claims fc ON fc.food_donation_id = fd.id
    WHERE fd.user_id = p.id AND fc.status IN ('received', 'completed')), 0)::bigint AS people_helped
FROM public.profiles p;

REVOKE ALL ON public.public_donor_impact FROM PUBLIC, anon;
GRANT SELECT ON public.public_donor_impact TO authenticated;
