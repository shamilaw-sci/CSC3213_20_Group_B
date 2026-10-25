import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { DetailedPersonCard } from '@/components/people/people-card';

test('associates visible profile content with the selected tab panel', () => {
  const markup = renderToStaticMarkup(
    <DetailedPersonCard
      person={{
        title: 'Mr',
        fullName: 'Sivothayan Sivasiva',
        registrationNo: 'S21513',
        studentType: 'UNDERGRADUATE',
        studentTrack: 'HONOURS',
        honoursProgramme: 'COMPUTER_SCIENCE',
        level: '3000',
        status: 'CURRENT',
        researchInterests: ['Computer Networks'],
      }}
    />
  );

  expect(markup).toContain('role="tabpanel"');
  expect(markup).toContain('Registration Number');
  expect(markup).not.toContain('flex-1 outline-none hidden');
});
