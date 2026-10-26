import publicEnvConfig from '@/config/public.env.config';

type NavigationDestination = 'local' | 'external-product';

export interface NavigationItem {
  destination: NavigationDestination;
  href: string;
  label: string;
}

export const externalProductUrls = {
  eLearning: publicEnvConfig.NEXT_PUBLIC_ELEARNING_SITE_URL,
  people: publicEnvConfig.NEXT_PUBLIC_PEOPLE_SITE_URL,
  projects: publicEnvConfig.NEXT_PUBLIC_PROJECTS_SITE_URL,
} as const;

export const primaryNavigation = [
  { href: '/', label: 'Home', destination: 'local' },
  { href: '/about-us', label: 'About', destination: 'local' },
  {
    href: '/undergraduate-courses',
    label: 'Undergraduate',
    destination: 'local',
  },
  {
    href: '/postgraduate-courses',
    label: 'Postgraduate',
    destination: 'local',
  },
  { href: '/research', label: 'Research', destination: 'local' },
  { href: '/resources', label: 'Resources', destination: 'local' },
  { href: '/societies', label: 'Societies', destination: 'local' },
  { href: '/contact', label: 'Contact', destination: 'local' },
] as const satisfies ReadonlyArray<NavigationItem>;

export const secondaryNavigation = [
  { href: '/services', label: 'Services', destination: 'local' },
  {
    href: '/prizes-scholarships',
    label: 'Prizes & scholarships',
    destination: 'local',
  },
  {
    href: externalProductUrls.people,
    label: 'People directory',
    destination: 'external-product',
  },
  {
    href: externalProductUrls.projects,
    label: 'Project showcase',
    destination: 'external-product',
  },
  {
    href: externalProductUrls.eLearning,
    label: 'E-learning',
    destination: 'external-product',
  },
] as const satisfies ReadonlyArray<NavigationItem>;
