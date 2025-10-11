WITH predefined_plans AS (
  SELECT *
  FROM (VALUES
    ('0f45f4e8-3c2e-4d3e-9a4c-2b04b2f86d11'::uuid, 'lower_strength', 'Lower Body Strength Split', 4, 'powerlifting', 'Lower-body emphasis focused on strength and posterior-chain development.'),
    ('2d8b2f6d-0dd9-4e88-9c93-8cde3f2c5a21'::uuid, 'upper_push_pull', 'Upper Push/Pull Split', 4, 'aesthetic', 'Upper-body split alternating push and pull days to balance pressing and pulling volume.')
  ) AS t(plan_id, plan_key, name, days_per_week, goal, description)
),
upsert_plans AS (
  INSERT INTO public.workout_plans (id, name, days_per_week, goal, description)
  SELECT plan_id, name, days_per_week, goal::public.workout_goal, description
  FROM predefined_plans
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        days_per_week = EXCLUDED.days_per_week,
        goal = EXCLUDED.goal,
        description = EXCLUDED.description
  RETURNING id
),
exercise_map AS (
  SELECT name, id FROM public.exercises
  WHERE name IN (
    'Barbell Back Squat',
    'Romanian Deadlift',
    'Incline Dumbbell Press',
    'Pull-Up',
    'Standing Overhead Press',
    'Cable Face Pull',
    'Bulgarian Split Squat',
    'Plank Shoulder Tap'
  )
),
plan_exercise_data AS (
  SELECT * FROM (VALUES
    ('lower_strength', 'Barbell Back Squat', 5, '5', 1),
    ('lower_strength', 'Romanian Deadlift', 4, '8', 1),
    ('lower_strength', 'Bulgarian Split Squat', 3, '12/leg', 2),
    ('lower_strength', 'Plank Shoulder Tap', 3, '45s', 2),
    ('upper_push_pull', 'Incline Dumbbell Press', 4, '10', 1),
    ('upper_push_pull', 'Standing Overhead Press', 4, '8', 1),
    ('upper_push_pull', 'Pull-Up', 4, 'AMRAP', 2),
    ('upper_push_pull', 'Cable Face Pull', 3, '15', 2)
  ) AS t(plan_key, exercise_name, sets, reps, day_number)
),
plan_lookup AS (
  SELECT plan_key, plan_id FROM predefined_plans
)
INSERT INTO public.workout_plan_exercises (workout_plan_id, exercise_id, sets, reps, day_number)
SELECT
  pl.plan_id,
  em.id,
  ped.sets,
  ped.reps,
  ped.day_number
FROM plan_exercise_data ped
JOIN plan_lookup pl ON ped.plan_key = pl.plan_key
JOIN exercise_map em ON ped.exercise_name = em.name;