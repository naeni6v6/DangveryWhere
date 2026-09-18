-- 식당·카페의 대표 메뉴. 강원 반려동반관광 원본의 '이용요금' 칸을 그대로 담습니다.
-- 강릉 스냅샷은 이 칸을 아직 받아 오지 않아 비어 있고, scripts/import-gangneung.mjs 를
-- 다시 돌리면 채워집니다. 준비 지역(춘천·양양·홍천·평창)은 DB 를 거치지 않고 저장본에서 바로 읽어요.
ALTER TABLE places ADD COLUMN IF NOT EXISTS menu text NOT NULL DEFAULT '';
