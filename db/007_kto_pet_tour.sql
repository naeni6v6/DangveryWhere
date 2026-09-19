-- 한국관광공사 반려동물 동반여행 원본(KorPetTourService2)에서 온 장소를 받습니다.
--
-- 이 원본은 관광지·레포츠·쇼핑처럼 기존 강릉 스냅샷에 없던 분류를 함께 줍니다.
-- 쇼핑은 '반려견을 데리고 들어갈 수 있는 매장'이라 동반 장소로 그대로 둡니다.
-- 문화시설은 이미 준비 데이터에만 있던 분류인데, 강릉에도 들어올 수 있어 함께 넓힙니다.
ALTER TABLE places DROP CONSTRAINT IF EXISTS places_category_check;
ALTER TABLE places ADD CONSTRAINT places_category_check CHECK (
  category IN ('food', 'stay', 'outdoor', 'activity', 'hospital', 'culture', 'shopping')
);

-- 관광공사 원본의 contentId 는 강원 반려동반관광(gw-<숫자>)·동물병원(gw-h-<숫자>)과
-- 번호 체계가 달라 같은 번호가 나올 수 있습니다. 덮어쓰기를 막으려고 gw-k- 접두사를 씁니다.
ALTER TABLE places DROP CONSTRAINT IF EXISTS places_id_check;
ALTER TABLE places ADD CONSTRAINT places_id_check CHECK (id ~ '^gw-(h-|k-)?[0-9]+$');
