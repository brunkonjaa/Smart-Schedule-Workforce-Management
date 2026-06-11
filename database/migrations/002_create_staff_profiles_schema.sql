CREATE TABLE staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  primary_role VARCHAR(50) NOT NULL,
  contract_hours NUMERIC(5,2) NOT NULL,
  phone_number VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staff_profiles_user_id_unique UNIQUE (user_id),
  CONSTRAINT staff_profiles_contract_hours_check CHECK (contract_hours >= 0),
  CONSTRAINT staff_profiles_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
);

CREATE INDEX staff_profiles_is_active_idx ON staff_profiles (is_active);
