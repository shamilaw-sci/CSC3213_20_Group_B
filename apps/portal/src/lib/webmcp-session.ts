export function portalToolsEnabled(
  isPending: boolean,
  hasUser: boolean
): boolean {
  return !isPending && hasUser;
}
