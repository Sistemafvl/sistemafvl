
CREATE POLICY "Anon can delete piso_entries"
  ON piso_entries FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can delete ps_entries"
  ON ps_entries FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can delete rto_entries"
  ON rto_entries FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can delete dnr_entries"
  ON dnr_entries FOR DELETE TO anon USING (true);
