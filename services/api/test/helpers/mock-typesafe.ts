// Test-only preload: the external classifier is the sole mocked provider.
const originalFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input) !== 'https://api.typesafe.ai/v1/systemone')
    return originalFetch(input, init);
  const uncertain = process.env.PHASE6_MODERATION_MODE === 'review';
  const answer = (choice: string, probability: number) => ({
    type: 'choice',
    choice,
    confidence: probability,
    probabilities: { [choice]: probability },
  });
  return Promise.resolve(
    Response.json({
      answers: {
        safety: answer('safe', 0.99),
        suitability: answer(
          uncertain ? 'uncertain' : 'portrait',
          uncertain ? 0.6 : 0.99
        ),
      },
    })
  );
}) as typeof fetch;
