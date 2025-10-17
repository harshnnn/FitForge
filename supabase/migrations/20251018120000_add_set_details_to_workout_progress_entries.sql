-- Add set_details jsonb column to support per-set weights and reps
alter table if exists public.workout_progress_entries
add column if not exists set_details jsonb null default '[]'::jsonb;

-- Optional: create an index for faster lookups by session
create index if not exists idx_workout_progress_entries_set_details_session on public.workout_progress_entries using btree (session_id);

-- NOTE: If you want to backfill from the existing reps_completed (text) column
-- you can run a migration to transform reps_completed (which is a JSON array string like "[10,8,12]")
-- into set_details with objects: [{"reps":10,"weight":null}, ...]
-- Example (run manually if desired):
-- update public.workout_progress_entries
-- set set_details = (
--   select jsonb_agg(jsonb_build_object('reps', (elem)::int, 'weight', null))
--   from jsonb_array_elements_text(reps_completed::jsonb) as elem
-- )
