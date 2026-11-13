import { parseHonoursSelection } from '@scs/identity';
import { expect, test } from 'bun:test';

test('expands ranges with exclusions then additional inclusions', () => {
  const result = parseHonoursSelection({
    batch: 'S21',
    include: '800-999',
    exclude: '845-850, 901, 950',
    additional: '720, 725',
  });
  expect(result.identifiers).toHaveLength(194);
  expect(result.identifiers).toContain('s21720');
  expect(result.identifiers).not.toContain('s21845');
  expect(result.identifiers).not.toContain('s21901');
});

test('deduplicates mixed normal and permanent identifiers', () => {
  const result = parseHonoursSelection({
    batch: 's21',
    include: '801, 801, sp345, s21sp345, 803-804',
    exclude: '803, sp345',
    additional: 'sp345',
  });
  expect(result.identifiers).toEqual(['s21801', 's21804', 's21sp345']);
});

test('rejects malformed, reversed, and oversized selections', () => {
  expect(() =>
    parseHonoursSelection({ batch: 's21', include: '850-800' })
  ).toThrow();
  expect(() =>
    parseHonoursSelection({ batch: 's21', include: '800-x' })
  ).toThrow();
  expect(() =>
    parseHonoursSelection({ batch: 's21', include: '800-999', maximum: 10 })
  ).toThrow();
});
