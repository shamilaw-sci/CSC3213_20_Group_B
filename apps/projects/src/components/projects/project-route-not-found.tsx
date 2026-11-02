import { StatePanel } from '@/components/projects/project-states';

export function ProjectRouteNotFound({
  title,
  description,
}: Readonly<{ title: string; description: string }>) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-16">
      <StatePanel
        title={title}
        description={description}
        action={{ href: '/browse', label: 'Browse all projects' }}
      />
    </main>
  );
}
