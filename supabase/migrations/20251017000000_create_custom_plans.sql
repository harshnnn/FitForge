-- Create enum for days of the week
CREATE TYPE public.day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');

-- Create user_custom_plans table
CREATE TABLE public.user_custom_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_custom_plan_exercises junction table
CREATE TABLE public.user_custom_plan_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_custom_plan_id UUID NOT NULL REFERENCES public.user_custom_plans(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  day_of_week day_of_week NOT NULL,
  sets INTEGER NOT NULL CHECK (sets > 0),
  reps TEXT NOT NULL, -- Can be "8-12" or "10" or "3x8-12" etc.
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.user_custom_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_plan_exercises ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_custom_plans
CREATE POLICY "Users can view their own custom plans"
  ON public.user_custom_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own custom plans"
  ON public.user_custom_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom plans"
  ON public.user_custom_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom plans"
  ON public.user_custom_plans FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for user_custom_plan_exercises
CREATE POLICY "Users can view exercises from their own custom plans"
  ON public.user_custom_plan_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_custom_plans
      WHERE id = user_custom_plan_exercises.user_custom_plan_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create exercises for their own custom plans"
  ON public.user_custom_plan_exercises FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_custom_plans
      WHERE id = user_custom_plan_exercises.user_custom_plan_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update exercises from their own custom plans"
  ON public.user_custom_plan_exercises FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_custom_plans
      WHERE id = user_custom_plan_exercises.user_custom_plan_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete exercises from their own custom plans"
  ON public.user_custom_plan_exercises FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_custom_plans
      WHERE id = user_custom_plan_exercises.user_custom_plan_id
      AND user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_user_custom_plans_user_id ON public.user_custom_plans(user_id);
CREATE INDEX idx_user_custom_plan_exercises_plan_id ON public.user_custom_plan_exercises(user_custom_plan_id);
CREATE INDEX idx_user_custom_plan_exercises_day ON public.user_custom_plan_exercises(day_of_week);

-- Create trigger for updated_at on user_custom_plans
CREATE TRIGGER set_updated_at_user_custom_plans
  BEFORE UPDATE ON public.user_custom_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();