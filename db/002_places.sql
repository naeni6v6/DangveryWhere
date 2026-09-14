CREATE TABLE IF NOT EXISTS places (
  id text PRIMARY KEY CHECK (id ~ '^gw-[0-9]+$'),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('food', 'stay', 'outdoor', 'activity')),
  address text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  phone text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  policy text NOT NULL DEFAULT '',
  hours text NOT NULL DEFAULT '',
  source_url text NOT NULL,
  imported_at date NOT NULL,
  verified_at date,
  source_weight numeric(5,1) CHECK (source_weight > 0),
  display_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS places_category ON places(category);
