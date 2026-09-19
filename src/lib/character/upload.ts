/**
 * 강아지 사진 업로드 전처리 (브라우저).
 * 서버(Cloudflare Workers)에서는 이미지를 줄일 수 없어서, 보내기 전에 브라우저 캔버스로
 * 긴 변 1024px JPEG 로 맞춥니다. 형식·크기 검사도 여기서 먼저 걸러 친절한 메시지를 보여 줘요.
 */
import { furColors, type FurColorKey } from '$lib/domain/character';

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const UPLOAD_EDGE = 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export class UploadError extends Error {}

export async function prepareDogPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))
    throw new UploadError('사진 파일(JPG, PNG, WEBP)만 올릴 수 있어요.');
  if (file.size > MAX_UPLOAD_BYTES)
    throw new UploadError('사진이 너무 커요. 12MB 이하 사진으로 다시 골라 주세요.');
  if (file.type && !ACCEPTED.includes(file.type))
    throw new UploadError('지원하지 않는 형식이에요. JPG, PNG, WEBP 사진을 올려 주세요.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new UploadError(
      file.type.includes('hei')
        ? '아이폰 HEIC 사진은 아직 읽지 못해요. JPG 로 바꿔서 올려 주세요.'
        : '사진을 읽지 못했어요. 다른 사진으로 다시 시도해 주세요.'
    );
  }
  const ratio = Math.min(1, UPLOAD_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new UploadError('이 브라우저에서는 사진을 처리할 수 없어요.');
  // 투명 PNG 는 흰 바탕 위에 얹어 JPEG 로 만듭니다.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * 사진 가운데 영역의 평균색으로 털 색 프리셋을 추정합니다.
 * 데모 모드(AI 없음)에서 "사진과 비슷한 색"으로 시작하려고 쓰는 값이라 대충 맞으면 충분해요.
 * 너무 어둡거나 밝은 픽셀(그늘·하늘·바닥)은 빼고, 사진이 대체로 어두운 걸 감안해 조금 밝힙니다.
 */
export async function guessCoatColor(src: string): Promise<FurColorKey> {
  try {
    const image = new Image();
    image.src = src;
    await image.decode();
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 'cream';
    ctx.drawImage(image, 0, 0, size, size);
    const { data } = ctx.getImageData(size * 0.25, size * 0.25, size * 0.5, size * 0.5);
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (lum < 28 || lum > 248) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
    if (!n) return 'cream';
    const lift = 1.12;
    const mean = [(r / n) * lift, (g / n) * lift, (b / n) * lift];
    let best: FurColorKey = 'cream';
    let bestDistance = Infinity;
    for (const color of furColors) {
      const value = parseInt(color.hex.slice(1), 16);
      const target = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
      const distance = target.reduce(
        (sum, channel, index) => sum + (channel - mean[index]) ** 2,
        0
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        best = color.key;
      }
    }
    return best;
  } catch {
    return 'cream';
  }
}

/** 캐릭터 카드·목록용 작은 사본 (긴 변 512px). 로컬 저장 용량을 아끼려고 씁니다. */
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
