-- Allow anon users to insert into user_profiles (app uses anon key without auth)
CREATE POLICY "Anyone can insert user_profiles"
ON public.user_profiles
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon users to update user_profiles
CREATE POLICY "Anyone can update user_profiles"
ON public.user_profiles
FOR UPDATE
TO anon
USING (true);
