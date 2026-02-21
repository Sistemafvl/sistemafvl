
DROP POLICY IF EXISTS "Authenticated can delete ride_tbrs" ON ride_tbrs;
CREATE POLICY "Anyone can delete ride_tbrs" ON ride_tbrs FOR DELETE USING (true);
