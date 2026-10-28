import { generateSecurityTxt, SECURITY_TXT_CANONICAL_URL } from '@scs/security';

const securityTxt = generateSecurityTxt({
  contact: ['mailto:s21513@sci.pdn.ac.lk'],
  expires: '2027-04-28T00:00:00Z',
  canonical: [SECURITY_TXT_CANONICAL_URL],
  policy: ['https://portal.scs-pdn.space/privacy#security-reporting'],
  preferredLanguages: ['en'],
});

export function GET() {
  return new Response(securityTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
