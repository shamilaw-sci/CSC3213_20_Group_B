import { ArrowRight, ArrowUpRight } from 'lucide-react';

import { AppLink } from '@/components/navigation/app-link';
import { secondaryNavigation } from '@/config/navigation.config';

export function QuickLinks() {
  return (
    <aside aria-labelledby="quick-links-heading" className="border-l pl-6">
      <h2
        id="quick-links-heading"
        className="text-primary text-xs font-semibold tracking-[0.18em]
          uppercase"
      >
        Quick links
      </h2>
      <ul className="mt-4 divide-y">
        {secondaryNavigation.map((item) => {
          const external = item.destination === 'external-product';
          const Icon = external ? ArrowUpRight : ArrowRight;
          return (
            <li key={item.href}>
              <AppLink
                href={item.href}
                destination={item.destination}
                aria-label={external ? `${item.label} (external)` : item.label}
                className="hover:text-primary flex min-h-11 items-center gap-3
                  text-sm transition-colors"
              >
                <span>{item.label}</span>
                {external ? (
                  <span className="text-muted-foreground text-xs">
                    External
                  </span>
                ) : null}
                <Icon aria-hidden="true" className="ml-auto size-4" />
              </AppLink>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
