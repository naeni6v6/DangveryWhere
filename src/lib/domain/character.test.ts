import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARAMS,
  describeTraits,
  layoutFromBounds,
  normalizeParams,
  normalizeTraits,
  sliders,
  validateCharacterInput,
  validateLayout
} from './character';

const layout = {
  head: { x: 0.4, y: 0.1, w: 0.5, h: 0.4 },
  body: { x: 0.1, y: 0.4, w: 0.6, h: 0.5 },
  eyeLeft: { x: 0.6, y: 0.3, w: 0.05, h: 0.05 }
};
const png = `data:image/png;base64,${'A'.repeat(64)}`;

describe('character params', () => {
  it('clamps every slider into its allowed range', () => {
    const params = normalizeParams({
      eyeSize: 9,
      tailSize: -1,
      headSize: 'big',
      furColor: 'brown'
    });
    expect(params.eyeSize).toBe(sliders.find((s) => s.key === 'eyeSize')!.max);
    expect(params.tailSize).toBe(sliders.find((s) => s.key === 'tailSize')!.min);
    expect(params.headSize).toBe(1);
    expect(params.furColor).toBe('brown');
  });
  it('falls back to defaults for unknown presets', () => {
    const params = normalizeParams({ eyeShape: 'anime', furColor: 'neon' });
    expect(params.eyeShape).toBe(DEFAULT_PARAMS.eyeShape);
    expect(params.furColor).toBe(DEFAULT_PARAMS.furColor);
  });
});

describe('character layout', () => {
  it('needs at least a head and a body', () => {
    expect(validateLayout({ head: layout.head })).toBeNull();
    const valid = validateLayout(layout);
    expect(valid?.eyeLeft).toEqual(layout.eyeLeft);
    expect(valid?.tail).toBeNull();
  });
  it('keeps boxes inside the image', () => {
    const valid = validateLayout({ ...layout, tail: { x: 0.9, y: 0.9, w: 0.5, h: 0.5 } });
    expect(valid?.tail?.w).toBeCloseTo(0.1);
    expect(valid?.tail?.h).toBeCloseTo(0.1);
  });
  it('derives a side-view layout from the dog bounds', () => {
    const derived = layoutFromBounds({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
    expect(derived.head.x).toBeGreaterThan(derived.body.x);
    expect(derived.head.y).toBeLessThan(derived.body.y);
    expect(derived.eyeLeft!.x + derived.eyeLeft!.w).toBeLessThanOrEqual(1);
  });
});

describe('dog traits', () => {
  it('narrows unknown values to safe defaults', () => {
    const traits = normalizeTraits({
      coatColor: 'rainbow',
      earType: 'floppy',
      coatHex: '#ABCDEF',
      distinctive: ['x', 3]
    });
    expect(traits.coatColor).toBe('cream');
    expect(traits.earType).toBe('floppy');
    expect(traits.coatHex).toBe('#abcdef');
    expect(traits.distinctive).toEqual(['x']);
  });
  it('describes traits for the prompt', () => {
    const text = describeTraits(
      normalizeTraits({ breedGuess: '푸들', breedKey: 'poodle', furTexture: 'curly' })
    );
    expect(text).toContain('breed: 푸들 (poodle)');
    expect(text).toContain('fur: curly');
  });
});

describe('character input', () => {
  it('accepts a complete character and drops a bad dog id', () => {
    const input = validateCharacterInput({
      finalImage: png,
      layout,
      dogId: 'nope',
      params: {},
      traits: {}
    });
    expect(input?.dogId).toBeNull();
    expect(input?.expression).toBe('smile');
  });
  it('rejects a character without a final image or layout', () => {
    expect(validateCharacterInput({ layout })).toBeNull();
    expect(validateCharacterInput({ finalImage: png })).toBeNull();
    expect(validateCharacterInput({ finalImage: 'https://evil/x.png', layout })).toBeNull();
  });
});
