import type { Metadata } from 'next';

import Courses from '@/views/course/Courses';

export const metadata: Metadata = {
  title: 'Courses',
  description: 'Browse SCS projects connected to courses.',
};

export default function Page() {
  return <Courses />;
}
