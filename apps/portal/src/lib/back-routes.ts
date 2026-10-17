export type ProfileToolSource = 'dashboard' | 'profile';

export function profileToolBackRoute(source: ProfileToolSource) {
  return source === 'profile'
    ? { href: '/user/me', label: 'Back to Info' }
    : { href: '/dashboard', label: 'Back to Dashboard' };
}
