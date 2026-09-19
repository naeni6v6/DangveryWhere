/**
 * 캐릭터 그림 손질 (브라우저).
 *
 * 예전에는 강아지 사진을 올려 받는 파일(upload.ts)이 있었지만, 사진만 보고 견종을 맞히는
 * 정확도가 낮아 업로드 기능을 걷어 냈습니다. 지금 남은 일은 저장 전에 그림을 줄이는 것뿐이에요.
 */

/** 캐릭터 카드·목록용 작은 사본 (긴 변 512px). 저장 용량을 아끼려고 씁니다. */
export async function shrinkDataUrl(src: string, edge = 512, type = 'image/jpeg', quality = 0.85) {
  const image = new Image();
  image.src = src;
  await image.decode();
  const ratio = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(type, quality);
}
