import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  PeopleCardSkeletonGrid,
  StudentCard,
} from '@/components/people/people-card';

test('keeps programme directory cards focused on student identity', () => {
  const markup = renderToStaticMarkup(
    <StudentCard
      student={{
        title: 'Mr',
        fullName: 'Sivothayan Sivasiva',
        registrationNo: 'S21513',
        studentType: 'UNDERGRADUATE',
        studentTrack: 'HONOURS',
        honoursProgramme: 'COMPUTER_SCIENCE',
        level: '3000',
        status: 'CURRENT',
      }}
    />
  );

  expect(markup).toContain('Sivothayan Sivasiva');
  expect(markup).toContain('S21513');
  expect(markup).not.toContain('Honours Undergraduate');
  expect(markup).toContain('View Profile');
  expect(markup).not.toContain('>View</span>');
});

test('matches the larger card layout in its loading skeleton', () => {
  const markup = renderToStaticMarkup(<PeopleCardSkeletonGrid count={1} />);

  expect(markup).toContain('grid-cols-1');
  expect(markup).toContain('sm:grid-cols-2');
  expect(markup).toContain('lg:grid-cols-3');
  expect(markup).toContain('h-10 w-full');
});
