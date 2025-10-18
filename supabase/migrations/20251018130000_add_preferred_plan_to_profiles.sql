-- Add preferred workout plan to profiles
ALTER TABLE public.profiles ADD COLUMN preferred_workout_plan_type TEXT;
ALTER TABLE public.profiles ADD COLUMN preferred_workout_plan_id UUID;

CREATE INDEX idx_profiles_preferred_plan_id ON public.profiles(preferred_workout_plan_id);

-- Optionally: Backfill logic to set preferred plan to latest custom plan per user (commented)
-- Backfill: set preferred plan to latest custom plan per user.
-- The previous query referenced an undefined alias (u) which caused the 42P01 missing FROM-clause error.
-- Use DISTINCT ON to pick the most recent custom plan per user (Postgres idiomatic approach).
-- Uncomment and run if you want to perform the backfill in your environment.
--
-- UPDATE public.profiles p
-- SET preferred_workout_plan_type = 'custom', preferred_workout_plan_id = uc.id
-- FROM (
--   SELECT DISTINCT ON (user_id) id, user_id
--   FROM public.user_custom_plans
--   ORDER BY user_id, created_at DESC
-- ) uc
-- WHERE p.user_id = uc.user_id;
