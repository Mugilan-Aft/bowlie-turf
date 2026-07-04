CREATE POLICY "Users can self-assign owner role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'owner'::public.app_role);