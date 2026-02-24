CREATE POLICY "Anyone can delete driver_rides"
  ON driver_rides FOR DELETE USING (true);