-- Add sharing table for custom plans
CREATE TABLE public.shared_custom_plan_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  user_custom_plan_id UUID NOT NULL REFERENCES public.user_custom_plans(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE public.shared_custom_plan_links ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view non-expired shared links (token itself is the secret)
CREATE POLICY "Anyone can view shared custom plans"
  ON public.shared_custom_plan_links FOR SELECT
  USING (expires_at IS NULL OR expires_at > now());

-- Only plan owners can create share links for their plans
CREATE POLICY "Plan owners can create share links"
  ON public.shared_custom_plan_links FOR INSERT
  WITH CHECK (
    auth.uid() = created_by_user_id AND
    EXISTS (
      SELECT 1 FROM public.user_custom_plans p
      WHERE p.id = shared_custom_plan_links.user_custom_plan_id
        AND p.user_id = auth.uid()
    )
  );

-- Allow owners to update or delete their share links
CREATE POLICY "Plan owners can update share links"
  ON public.shared_custom_plan_links FOR UPDATE
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Plan owners can delete share links"
  ON public.shared_custom_plan_links FOR DELETE
  USING (auth.uid() = created_by_user_id);

CREATE INDEX idx_shared_custom_plan_links_plan_id ON public.shared_custom_plan_links(user_custom_plan_id);
CREATE INDEX idx_shared_custom_plan_links_token ON public.shared_custom_plan_links(token);
