/**
 * 캐릭터 생성에 쓰는 프롬프트와 출력 스키마.
 *
 * STYLE_GUIDE 는 assets/breeds 의 견종 캐릭터 18종을 직접 보고 정리한 공통 규칙입니다.
 * 새 캐릭터가 "같은 세계관"으로 보이게 하는 핵심이라, 그림체를 바꾸고 싶으면 여기만 고치면 돼요.
 */
import {
  describeTraits,
  expressions,
  type DogTraits,
  type Expression
} from '$lib/domain/character';

export const STYLE_GUIDE = `DangveryWhere character style (match it exactly):
- A chibi 3D dog figure rendered like a matte, soft-touch vinyl toy / smooth clay. Clean, simple, sculpted forms.
- Proportions: an oversized round head about as large as the body; short chubby legs; a compact rounded body; tiny rounded paws with no toe detail.
- Pose: standing on all four legs, three-quarter view facing the viewer's RIGHT, head turned slightly toward the camera, calm and friendly.
- Eyes: two SMALL glossy black bead eyes with a single white specular highlight each, set wide and low on the face. No visible iris, no whites of the eyes, no eyelashes.
- Nose: a rounded glossy button nose. Mouth: a thin dark line in a gentle closed smile.
- Fur is sculpted as smooth soft lobes and clumps, never as individual hair strands. Curly coats become bubbly rounded clusters; long coats become smooth flowing lobes; short coats are perfectly smooth.
- Colors: warm, slightly desaturated pastel tones with soft gradient shading. Inner ears pale pink where visible.
- Lighting: soft studio light from the upper left, gentle ambient occlusion, a faint soft contact shadow directly under the paws.
- Background: plain pure white (#FFFFFF). Nothing else in the scene. No collar, no accessories, no props, no text, no watermark.
- Framing: square 1:1, the whole dog centered and filling about 75% of the frame, paws at roughly 88% of the image height.`;

/** 분석 결과 JSON 스키마. Claude 와 Gemini 가 같은 것을 씁니다. */
export const traitsSchema = {
  type: 'object',
  properties: {
    breedGuess: {
      type: 'string',
      description:
        'Most likely breed in Korean (e.g. 푸들, 말티즈, 믹스). If mixed, name the closest breed with 믹스.'
    },
    coatColor: {
      type: 'string',
      enum: ['white', 'cream', 'beige', 'brown', 'black', 'gray'],
      description: 'Closest preset for the MAIN coat color.'
    },
    coatHex: { type: 'string', description: 'Dominant coat color as a hex like #c9a57a' },
    coatPattern: {
      type: 'string',
      enum: ['solid', 'bicolor', 'tricolor', 'brindle', 'spotted', 'merle']
    },
    markings: {
      type: 'string',
      description:
        'Where the secondary colors/markings are, in English, one sentence. Empty if solid.'
    },
    furTexture: { type: 'string', enum: ['smooth', 'fluffy', 'curly', 'wiry', 'long'] },
    earType: { type: 'string', enum: ['floppy', 'upright', 'semi', 'button'] },
    earSize: { type: 'string', enum: ['small', 'medium', 'large'] },
    muzzle: { type: 'string', enum: ['short', 'medium', 'long'] },
    faceShape: { type: 'string', enum: ['round', 'oval', 'long'] },
    eyeColor: { type: 'string' },
    noseColor: { type: 'string', enum: ['black', 'brown', 'pink'] },
    bodyType: { type: 'string', enum: ['small', 'medium', 'large'] },
    tail: { type: 'string', enum: ['curled', 'straight', 'fluffy', 'short', 'docked'] },
    distinctive: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Up to 5 short English phrases about what makes THIS dog recognizable (e.g. "white blaze on chest", "one ear folds forward").'
    },
    summaryKo: {
      type: 'string',
      description:
        "One friendly Korean sentence summarizing the dog's look, under 60 characters, for the owner to read."
    }
  },
  required: [
    'breedGuess',
    'coatColor',
    'coatHex',
    'coatPattern',
    'markings',
    'furTexture',
    'earType',
    'earSize',
    'muzzle',
    'faceShape',
    'eyeColor',
    'noseColor',
    'bodyType',
    'tail',
    'distinctive',
    'summaryKo'
  ]
} as const;

export function analysisPrompt(breedHint?: string) {
  return `You are helping turn a photo of a real pet dog into a game character. Look carefully at the photo and describe the dog's physical features so an illustrator could recognize this individual dog. Report exactly what you see: coat colors and where each color sits, fur texture, ear shape, muzzle length, face shape, body build, tail, nose color, and anything distinctive.${breedHint ? ` The owner says the breed is "${breedHint}"; use that unless the photo clearly disagrees.` : ''} If the photo does not contain a dog, still fill the schema with your best guess and mention it in summaryKo.`;
}

export function generationPrompt(
  traits: DogTraits,
  expression: Expression,
  referenceCount: number
) {
  const mood =
    expressions.find((entry) => entry.key === expression)?.prompt ?? expressions[0].prompt;
  return `${STYLE_GUIDE}

The first ${referenceCount} image(s) are existing characters from this set. Use them ONLY as the style reference (material, proportions, eyes, lighting, background). Do NOT copy their breed, colors or markings.

The LAST image is a photo of the owner's real dog. Create ONE new character of THIS dog in exactly the reference style. The owner must recognize their own dog, so preserve these features faithfully:
${describeTraits(traits)}

Keep the coat colors, color placement and markings from the photo. Keep the ear shape, muzzle length, body type and tail shape. Expression: ${mood}. Same pose, view, framing and white background as the references. Output only the image.`;
}

export const layoutPrompt = `Detect these parts of the cartoon dog in the image and return a bounding box for each one that is visible: head (the whole head including ears), body (torso and legs, excluding the head), left_eye, right_eye, nose, left_ear, right_ear, tail. "left" and "right" mean the viewer's left and right. Return JSON: an array of {"label": string, "box_2d": [ymin, xmin, ymax, xmax]} with coordinates normalized to 0-1000. Skip parts that are not visible.`;

export const layoutSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      label: {
        type: 'string',
        enum: ['head', 'body', 'left_eye', 'right_eye', 'nose', 'left_ear', 'right_ear', 'tail']
      },
      box_2d: { type: 'array', items: { type: 'integer' } }
    },
    required: ['label', 'box_2d']
  }
} as const;
