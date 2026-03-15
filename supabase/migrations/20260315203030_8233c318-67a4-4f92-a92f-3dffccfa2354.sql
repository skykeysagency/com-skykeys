
-- Allow managers and admins to view all profiles
CREATE POLICY "Managers and admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role)
  );
