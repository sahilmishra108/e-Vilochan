-- Create table for storing vital signs readings
CREATE TABLE public.vitals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hr INTEGER,
  pulse INTEGER,
  spo2 INTEGER,
  abp TEXT,
  pap TEXT,
  etco2 INTEGER,
  awrr INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source TEXT NOT NULL CHECK (source IN ('camera', 'video')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since this is a monitoring system)
CREATE POLICY "Allow all operations on vitals"
ON public.vitals
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster queries by timestamp
CREATE INDEX idx_vitals_timestamp ON public.vitals(timestamp DESC);
CREATE INDEX idx_vitals_source ON public.vitals(source);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.vitals;