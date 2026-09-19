-- 내 강아지 캐릭터. 사진 한 장으로 만든 3D 캐릭터와 커스터마이징 값을 계정에 남깁니다.
-- 그림은 data URL(base64) 문자열로 넣습니다. 최종 그림은 640px WebP 라 대략 60~120KB 예요.
-- 강아지를 지우면 캐릭터는 남고 dog_id 만 비워집니다 (다른 아이에게 다시 붙일 수 있게).
CREATE TABLE IF NOT EXISTS dog_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  dog_id uuid REFERENCES dog_profiles(id) ON DELETE SET NULL,
  source_image text,
  character_image text,
  final_image text NOT NULL,
  traits jsonb NOT NULL,
  layout jsonb NOT NULL,
  params jsonb NOT NULL,
  expression text NOT NULL DEFAULT 'smile',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dog_characters_user ON dog_characters(user_id, updated_at DESC);
