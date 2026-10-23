import type { Metadata } from 'next';

import Courses from '@/app/courses/_components/courses';

export const metadata: Metadata = {
  title: 'Courses',
  description: 'Browse SCS projects connected to courses.',
};

export default function Page() {
  return <Courses />;
}
