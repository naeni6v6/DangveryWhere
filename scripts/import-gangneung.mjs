// Usage: node scripts/import-gangneung.mjs <official API snapshot JSON>
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Provide a Gangwon API snapshot path.');
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const categories = { 식음료: 'food', 숙박: 'stay', 관광지: 'outdoor', 체험: 'activity' };
const clean = (value) =>
  String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();
const places = source.details
  .filter((row) => categories[row.partName])
  .map((row) => ({
    id: `gw-${row.contentSeq}`,
    name: clean(row.title),
    category: categories[row.partName],
    address: clean(row.address),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    phone: clean(row.tel),
    description: clean(row.content),
    policy: clean(row.policyCautions),
    hours: clean(row.usedTime),
    sourceUrl: `https://www.pettravel.kr/petapi/data/${{ food: 'food', stay: 'lodge', outdoor: 'tour', activity: 'experience' }[categories[row.partName]]}?contentSeq=${row.contentSeq}`,
    importedAt: source.retrieved,
    verifiedAt: null,
    sourceWeight:
      row.petWeight !== '' && Number.isFinite(Number(row.petWeight)) ? Number(row.petWeight) : null
  }));
if (new Set(places.map((place) => place.id)).size !== places.length)
  throw new Error('Duplicate source IDs');
if (places.some((place) => !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)))
  throw new Error('Invalid coordinates');
await mkdir('src/lib/server/data', { recursive: true });
await writeFile('src/lib/server/data/gangneung.json', JSON.stringify(places, null, 2) + '\n');
console.log(`Imported ${places.length} source records; policies remain unverified.`);
