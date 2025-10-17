-- Create tables for daily progress logging feature
-- This migration adds support for users to log their workout progress

-- Create workout_progress_sessions table
-- Tracks each progress logging session (which plan, day, and date)
CREATE TABLE public.workout_progress_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('standard', 'custom')),
  plan_id UUID NOT NULL, -- References either workout_plans.id or user_custom_plans.id
  day_identifier TEXT NOT NULL, -- Either "day_1", "day_2" etc. for standard plans, or "monday", "tuesday" etc. for custom plans
  workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure one session per user per plan per day
  UNIQUE(user_id, plan_type, plan_id, day_identifier, workout_date)
);

-- Create workout_progress_entries table
-- Tracks individual exercise logs within a progress session
CREATE TABLE public.workout_progress_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_progress_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  planned_sets INTEGER NOT NULL,
  planned_reps TEXT NOT NULL,
  actual_sets INTEGER NOT NULL DEFAULT 0,
  weight_used DECIMAL(6,2), -- Weight in kg/lbs
  weight_unit TEXT CHECK (weight_unit IN ('kg', 'lbs')) DEFAULT 'kg',
  reps_completed TEXT, -- JSON array of reps per set, e.g., "[10, 8, 12]"
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on progress tables
ALTER TABLE public.workout_progress_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_progress_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workout_progress_sessions
CREATE POLICY "Users can view their own progress sessions"
  ON public.workout_progress_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own progress sessions"
  ON public.workout_progress_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress sessions"
  ON public.workout_progress_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own progress sessions"
  ON public.workout_progress_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for workout_progress_entries
CREATE POLICY "Users can view their own progress entries"
  ON public.workout_progress_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_progress_sessions
      WHERE id = session_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own progress entries"
  ON public.workout_progress_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_progress_sessions
      WHERE id = session_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own progress entries"
  ON public.workout_progress_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_progress_sessions
      WHERE id = session_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own progress entries"
  ON public.workout_progress_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_progress_sessions
      WHERE id = session_id AND user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_workout_progress_sessions_user_date ON public.workout_progress_sessions(user_id, workout_date);
CREATE INDEX idx_workout_progress_sessions_plan ON public.workout_progress_sessions(plan_type, plan_id);
CREATE INDEX idx_workout_progress_entries_session ON public.workout_progress_entries(session_id);
CREATE INDEX idx_workout_progress_entries_exercise ON public.workout_progress_entries(exercise_id);

-- Create function to update updated_at timestamp for progress tables
CREATE TRIGGER set_updated_at_progress_sessions
  BEFORE UPDATE ON public.workout_progress_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_progress_entries
  BEFORE UPDATE ON public.workout_progress_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();