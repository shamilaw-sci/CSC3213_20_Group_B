import {
  type AvatarClassification,
  type AvatarProvider,
  createAvatarModerator,
  createTypeSafeProvider,
} from '@scs/moderation/avatar';
import { describe, expect, test } from 'bun:test';

const safety = ['safe', 'sexual', 'violence', 'hate', 'gesture', 'uncertain'];
const suitability = [
  'portrait',
  'blurry',
  'obscured',
  'non_portrait',
  'meme_logo',
  'multiple',
  'uncertain',
];
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

function answer(value: string, options: string[], confidence = 0.9) {
  return {
    type: 'choice',
    choice: value,
    confidence,
    probabilities: Object.fromEntries(
      options.map((option) => [option, option === value ? 0.95 : 0.01])
    ),
  };
}

function payload(safetyValue: string, portraitValue: string) {
  return {
    answers: {
      safety: answer(safetyValue, safety),
      suitability: answer(portraitValue, suitability),
    },
  };
}

async function decision(response: unknown) {
  const provider = createTypeSafeProvider({
    apiKey: 'test-key',
    fetch: async () => Response.json(response),
  });
  return createAvatarModerator({ provider }).moderate(jpeg);
}

describe('avatar moderation', () => {
  test('approves a safe portrait with the existing result mapping', async () => {
    expect(await decision(payload('safe', 'portrait'))).toEqual({
      status: 'approved',
      code: 'approved',
      message: 'Picture approved',
      checks: [
        { id: 'safety', status: 'passed' },
        { id: 'portrait', status: 'passed' },
      ],
    });
  });

  test.each(['sexual', 'violence', 'hate', 'gesture'])(
    'rejects unsafe %s',
    async (kind) => {
      expect(await decision(payload(kind, 'portrait'))).toMatchObject({
        status: 'rejected',
        code: 'unsafe_content',
      });
    }
  );

  test.each(['blurry', 'obscured', 'non_portrait', 'meme_logo', 'multiple'])(
    'rejects unsuitable %s',
    async (kind) => {
      expect(await decision(payload('safe', kind))).toMatchObject({
        status: 'rejected',
        code: 'unsuitable_portrait',
      });
    }
  );

  test('sends uncertain and low-confidence results to review', async () => {
    expect(await decision(payload('uncertain', 'portrait'))).toMatchObject({
      status: 'review_required',
      checks: [
        { id: 'safety', status: 'needs_review' },
        { id: 'portrait', status: 'passed' },
      ],
    });
    const low = payload('safe', 'portrait');
    low.answers.safety.confidence = 0.1;
    expect(await decision(low)).toMatchObject({ status: 'review_required' });
    low.answers.safety = answer('sexual', safety, 0.1);
    expect(await decision(low)).toMatchObject({ status: 'review_required' });
  });

  test('fails closed on missing or malformed classifications', async () => {
    for (const response of [
      { answers: {} },
      { answers: { safety: answer('safe', safety) } },
      {
        answers: {
          ...payload('safe', 'portrait').answers,
          safety: answer('unknown', safety),
        },
      },
      {
        answers: {
          ...payload('safe', 'portrait').answers,
          safety: { ...answer('safe', safety), probabilities: {} },
        },
      },
    ]) {
      expect(await decision(response)).toMatchObject({
        status: 'unavailable',
        code: 'moderation_invalid_response',
      });
    }
  });

  test('uses the established TypeSafe request, image, and timeout', async () => {
    const provider = createTypeSafeProvider({
      apiKey: 'test-key',
      fetch: async (url, init) => {
        expect(url).toBe('https://api.typesafe.ai/v1/systemone');
        expect(init.method).toBe('POST');
        const headers = new Headers(init.headers);
        expect(headers.get('Authorization')).toBe('Bearer test-key');
        expect(headers.get('TypeSafe-Danger-Zone-Images')).toBe('true');
        const form = init.body as FormData;
        const image = form.get('photo');
        expect(image).toBeInstanceOf(File);
        if (!(image instanceof File)) throw new Error('Missing image part');
        expect(new Uint8Array(await image.arrayBuffer())).toEqual(jpeg);
        const request = form.get('request');
        if (!(request instanceof File)) throw new Error('Missing request part');
        const body = JSON.parse(await request.text());
        expect(body.model).toBe('jev-latest');
        expect(Object.keys(body.questions)).toEqual(['safety', 'suitability']);
        expect(init.signal).toBeInstanceOf(AbortSignal);
        return Response.json(payload('safe', 'portrait'));
      },
    });
    expect(
      await createAvatarModerator({ provider }).moderate(jpeg)
    ).toMatchObject({
      status: 'approved',
    });
  });

  test('fails closed on network, HTTP, timeout, and missing credentials', async () => {
    const failedFetch = async () => {
      throw new Error('network');
    };
    for (const provider of [
      createTypeSafeProvider({ apiKey: '', fetch: failedFetch }),
      createTypeSafeProvider({ apiKey: 'test-key', fetch: failedFetch }),
      createTypeSafeProvider({
        apiKey: 'test-key',
        fetch: async () => new Response(null, { status: 500 }),
      }),
      createTypeSafeProvider({
        apiKey: 'test-key',
        fetch: async () => {
          throw new DOMException('Timeout', 'TimeoutError');
        },
      }),
    ]) {
      expect(
        await createAvatarModerator({ provider }).moderate(jpeg)
      ).toMatchObject({
        status: 'unavailable',
        code: 'moderation_unavailable',
      });
    }
  });

  test('accepts an injected provider without TypeSafe response structures', async () => {
    const classification: AvatarClassification = {
      safety: { value: 'safe', confidence: 0.9, probability: 0.95 },
      portrait: { value: 'portrait', confidence: 0.9, probability: 0.95 },
    };
    const provider: AvatarProvider = {
      classify: async () => ({ kind: 'classification', classification }),
    };
    expect(
      await createAvatarModerator({ provider }).moderate(jpeg)
    ).toMatchObject({
      status: 'approved',
    });
  });
});
