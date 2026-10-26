import Link from 'next/link';
import type { ComponentProps } from 'react';

import type { NavigationItem } from '@/config/navigation.config';

interface AppLinkProps extends Omit<ComponentProps<'a'>, 'href'> {
  destination: NavigationItem['destination'];
  href: string;
}

export function AppLink({ destination, href, ...props }: AppLinkProps) {
  if (destination === 'external-product') {
    return <a href={href} {...props} />;
  }

  return <Link href={href} {...props} />;
}
