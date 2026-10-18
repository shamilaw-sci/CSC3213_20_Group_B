export function emailPathSegment(email: string): string {
  return encodeURIComponent(email).replaceAll('%40', '@');
}
