-- 식음료를 카페 / 식당으로 나누고, 동물병원 분류를 받을 수 있게 넓힙니다.
-- category 는 그대로 두고 food_kind 를 따로 둡니다. 모바일 앱(/)의 '카페·음식점'
-- 묶음을 건드리지 않으면서 웹(PC)에서만 한 단계 더 쪼개기 위해서입니다.
ALTER TABLE places ADD COLUMN IF NOT EXISTS food_kind text;

-- NULL 을 허용해 두어야 이미 데이터가 들어 있는 DB 에서도 이 마이그레이션이 통과합니다.
-- 실제 값은 db:setup 이 스냅샷(gangneung.json)을 보고 채웁니다.
ALTER TABLE places DROP CONSTRAINT IF EXISTS places_food_kind_check;
ALTER TABLE places ADD CONSTRAINT places_food_kind_check CHECK (
  food_kind IS NULL OR (category = 'food' AND food_kind IN ('cafe', 'restaurant'))
);

ALTER TABLE places DROP CONSTRAINT IF EXISTS places_category_check;
ALTER TABLE places ADD CONSTRAINT places_category_check CHECK (
  category IN ('food', 'stay', 'outdoor', 'activity', 'hospital')
);

-- 동물병원은 원본에서 번호 체계가 따로라, 동반 장소와 같은 번호가 나올 수 있습니다.
-- 덮어쓰기를 막으려고 gw-h- 접두사를 쓰고, id 규칙을 거기에 맞춰 넓힙니다.
ALTER TABLE places DROP CONSTRAINT IF EXISTS places_id_check;
ALTER TABLE places ADD CONSTRAINT places_id_check CHECK (id ~ '^gw-(h-)?[0-9]+$');

CREATE INDEX IF NOT EXISTS places_food_kind ON places(food_kind);
