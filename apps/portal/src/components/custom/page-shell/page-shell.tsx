import { cn } from '@/lib/utils';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  width?: 'default' | 'wide' | 'narrow';
}

export function PageShell({
  children,
  className,
  width = 'default',
}: PageShellProps) {
  return (
    <div
      className={cn(
        'container mx-auto space-y-6 px-4 py-8',
        width === 'wide' && 'max-w-6xl',
        width === 'default' && 'max-w-5xl',
        width === 'narrow' && 'max-w-3xl',
        className
      )}
    >
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  icon,
  action,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {icon}
          <h1 className="text-2xl font-semibold">{title}</h1>
        </div>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
