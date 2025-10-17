-- Fix RLS policies to allow guest users to view exercises and workout plans
-- This migration updates the RLS policies for exercises and workout_plans tables
-- to allow public access for SELECT operations, enabling guest users to view content

-- Update exercises table policy to allow public read access
DROP POLICY IF EXISTS "Anyone can view exercises" ON public.exercises;
CREATE POLICY "Anyone can view exercises"
  ON public.exercises FOR SELECT
  USING (true);

-- Update workout_plans table policy to allow public read access
DROP POLICY IF EXISTS "Anyone can view workout plans" ON public.workout_plans;
CREATE POLICY "Anyone can view workout plans"
  ON public.workout_plans FOR SELECT
  USING (true);

-- Update workout_plan_exercises table policy to allow public read access
DROP POLICY IF EXISTS "Anyone can view workout plan exercises" ON public.workout_plan_exercises;
CREATE POLICY "Anyone can view workout plan exercises"
  ON public.workout_plan_exercises FOR SELECT
  USING (true);