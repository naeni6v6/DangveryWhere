-- 한 계정에 반려견 여러 마리.
-- dog_profiles 는 user_id 가 기본키라 계정당 한 마리만 저장됐어요. 기본키를 id 로 옮깁니다.
-- 이미 저장된 프로필은 id 만 새로 받고 그대로 남습니다.
ALTER TABLE dog_profiles ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
UPDATE dog_profiles SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE dog_profiles ALTER COLUMN id SET NOT NULL;
ALTER TABLE dog_profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- 지웠다 다시 만들어서 여러 번 실행해도 안전하게 합니다.
ALTER TABLE dog_profiles DROP CONSTRAINT IF EXISTS dog_profiles_pkey;
ALTER TABLE dog_profiles ADD CONSTRAINT dog_profiles_pkey PRIMARY KEY (id);
CREATE INDEX IF NOT EXISTS dog_profiles_user ON dog_profiles(user_id);

-- 한 계정이 끝없이 늘리지 못하게 막는 건 애플리케이션(api/profile)에서 합니다.

-- 동물병원 id 는 gw-h- 로 시작해서 기존 규칙에 걸려 찜이 저장되지 않았어요.
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_place_id_check;
ALTER TABLE favorites ADD CONSTRAINT favorites_place_id_check CHECK (place_id ~ '^gw-(h-)?[0-9]+$');
