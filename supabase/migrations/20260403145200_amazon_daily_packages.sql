CREATE TABLE IF NOT EXISTS amazon_daily_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    reference_date DATE NOT NULL,
    package_count INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(unit_id, reference_date)
);

ALTER TABLE amazon_daily_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users" 
ON amazon_daily_packages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" 
ON amazon_daily_packages FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" 
ON amazon_daily_packages FOR UPDATE TO authenticated USING (true);
