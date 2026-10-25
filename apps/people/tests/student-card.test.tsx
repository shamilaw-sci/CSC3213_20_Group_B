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

test('matches the mobile card action geometry in its loading skeleton', () => {
  const markup = renderToStaticMarkup(<PeopleCardSkeletonGrid count={1} />);

  expect(markup).toContain('size-9');
  expect(markup).toContain('rounded-full');
  expect(markup).toContain('sm:w-full');
});
