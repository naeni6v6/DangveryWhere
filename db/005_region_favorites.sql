-- 찜한 장소에 준비 지역(춘천·양양·서귀포·평창·제주시·태안·홍천·가평)을 담을 수 있게 넓힙니다.
-- 준비 데이터의 id 는 'region-<지역코드>-<20자리 16진수>' 입니다 (docs/REGION_DATA_GUIDE.txt 4절).
-- places 테이블에는 넣지 않습니다. 이 저장본은 업체 확인 전이라 db:setup 은 지금도 강릉만 적재해요.
-- 그래서 favorites.place_id 에는 외래키를 두지 않고, 형식만 확인합니다.
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_place_id_check;
ALTER TABLE favorites ADD CONSTRAINT favorites_place_id_check CHECK (
  place_id ~ '^gw-(h-)?[0-9]+$'
  OR place_id ~ '^region-(chuncheon|yangyang|seogwipo|pyeongchang|jeju-si|taean|hongcheon|gapyeong)-[0-9a-f]{20}$'
);
