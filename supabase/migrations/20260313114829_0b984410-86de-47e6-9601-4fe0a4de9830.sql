-- Allow admins to delete any lead (needed for "delete all leads of a user" feature)
CREATE POLICY "Admins can delete any lead"
ON public.leads
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));