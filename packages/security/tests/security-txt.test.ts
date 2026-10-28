import {
  generateSecurityTxt,
  getSecurityTxtRedirectTarget,
  isSecurityTxtPath,
  SECURITY_TXT_CANONICAL_URL,
} from '@scs/security';
import { describe, expect, test } from 'bun:test';

const now = new Date('2026-10-28T00:00:00Z');

describe('security.txt generation', () => {
  test('serializes the supported RFC 9116 fields with a trailing newline', () => {
    expect(
      generateSecurityTxt(
        {
          contact: ['mailto:s21513@sci.pdn.ac.lk', 'tel:+94-81-239-4555'],
          expires: '2027-04-28T00:00:00Z',
          canonical: [SECURITY_TXT_CANONICAL_URL],
          policy: ['https://portal.scs-pdn.space/privacy#security-reporting'],
          encryption: [
            'dns:security._openpgpkey.scs-pdn.space?type=OPENPGPKEY',
            'openpgp4fpr:5f2de5521c63a801ab59ccb603d49de44b29100f',
          ],
          acknowledgments: ['https://portal.scs-pdn.space/security/thanks'],
          hiring: ['https://portal.scs-pdn.space/security/jobs'],
          preferredLanguages: ['en-us', 'si'],
        },
        now
      )
    ).toBe(
      [
        'Contact: mailto:s21513@sci.pdn.ac.lk',
        'Contact: tel:+94-81-239-4555',
        'Expires: 2027-04-28T00:00:00Z',
        `Canonical: ${SECURITY_TXT_CANONICAL_URL}`,
        'Policy: https://portal.scs-pdn.space/privacy#security-reporting',
        'Encryption: dns:security._openpgpkey.scs-pdn.space?type=OPENPGPKEY',
        'Encryption: openpgp4fpr:5f2de5521c63a801ab59ccb603d49de44b29100f',
        'Acknowledgments: https://portal.scs-pdn.space/security/thanks',
        'Hiring: https://portal.scs-pdn.space/security/jobs',
        'Preferred-Languages: en-US, si',
        '',
      ].join('\n')
    );
  });

  test('requires at least one contact and a future RFC 3339 expiration', () => {
    expect(() =>
      generateSecurityTxt({ contact: [], expires: '2027-04-28T00:00:00Z' }, now)
    ).toThrow();
    expect(() =>
      generateSecurityTxt(
        {
          contact: ['mailto:s21513@sci.pdn.ac.lk'],
          expires: 'April 28, 2027',
        },
        now
      )
    ).toThrow();
    expect(() =>
      generateSecurityTxt(
        {
          contact: ['mailto:s21513@sci.pdn.ac.lk'],
          expires: '2026-10-28T00:00:00Z',
        },
        now
      )
    ).toThrow();
  });

  test('rejects CR/LF injection in every configured string value', () => {
    const configurations = [
      { contact: ['mailto:s21513@sci.pdn.ac.lk\nPolicy: https://evil.test'] },
      { canonical: ['https://portal.scs-pdn.space/\rInjected: value'] },
      { policy: ['https://portal.scs-pdn.space/privacy\nInjected: value'] },
      { encryption: ['dns:key.example\rInjected: value'] },
      { acknowledgments: ['https://example.com/thanks\nInjected: value'] },
      { hiring: ['https://example.com/jobs\rInjected: value'] },
      { preferredLanguages: ['en\nContact: mailto:evil@example.com'] },
    ];

    for (const configuration of configurations) {
      expect(() =>
        generateSecurityTxt(
          {
            contact: ['mailto:s21513@sci.pdn.ac.lk'],
            expires: '2027-04-28T00:00:00Z',
            ...configuration,
          },
          now
        )
      ).toThrow();
    }
  });

  test('accepts RFC field schemes and rejects insecure web URLs', () => {
    expect(() =>
      generateSecurityTxt(
        {
          contact: ['https://portal.scs-pdn.space/privacy'],
          expires: '2027-04-28T00:00:00+05:30',
        },
        now
      )
    ).not.toThrow();
    expect(() =>
      generateSecurityTxt(
        {
          contact: ['http://portal.scs-pdn.space/privacy'],
          expires: '2027-04-28T00:00:00Z',
        },
        now
      )
    ).toThrow();
    expect(() =>
      generateSecurityTxt(
        {
          contact: ['mailto:s21513@sci.pdn.ac.lk'],
          expires: '2027-04-28T00:00:00Z',
          policy: ['http://portal.scs-pdn.space/privacy'],
        },
        now
      )
    ).toThrow();
  });

  test('canonicalizes valid language tags and rejects invalid tags', () => {
    expect(
      generateSecurityTxt(
        {
          contact: ['mailto:s21513@sci.pdn.ac.lk'],
          expires: '2027-04-28T00:00:00Z',
          preferredLanguages: ['en-us'],
        },
        now
      )
    ).toContain('Preferred-Languages: en-US\n');
    expect(() =>
      generateSecurityTxt(
        {
          contact: ['mailto:s21513@sci.pdn.ac.lk'],
          expires: '2027-04-28T00:00:00Z',
          preferredLanguages: ['not_a_language'],
        },
        now
      )
    ).toThrow();
  });
});

describe('security.txt discovery', () => {
  test('matches only the two supported paths without case sensitivity', () => {
    for (const path of [
      '/security.txt',
      '/SECURITY.TXT',
      '/Security.Txt',
      '/.well-known/security.txt',
      '/.WELL-KNOWN/SECURITY.TXT',
      '/.Well-Known/Security.Txt',
    ]) {
      expect(isSecurityTxtPath(path), path).toBe(true);
    }

    for (const path of [
      '/security.txt/extra',
      '/files/security.txt',
      '/.well-known/security.txt.bak',
      '/security%2Etxt',
      '/',
    ]) {
      expect(isSecurityTxtPath(path), path).toBe(false);
    }
  });

  test('redirects GET and HEAD to the exact canonical URL without queries', () => {
    for (const method of ['GET', 'HEAD']) {
      expect(
        getSecurityTxtRedirectTarget({
          method,
          url: 'https://people.scs-pdn.space/SECURITY.TXT?source=test',
        })
      ).toBe(SECURITY_TXT_CANONICAL_URL);
    }
  });

  test('lets Portal serve only its exact canonical path', () => {
    expect(
      getSecurityTxtRedirectTarget({
        method: 'GET',
        url: SECURITY_TXT_CANONICAL_URL,
      })
    ).toBeUndefined();
    expect(
      getSecurityTxtRedirectTarget({
        method: 'GET',
        url: `${SECURITY_TXT_CANONICAL_URL}?source=test`,
      })
    ).toBeUndefined();
    expect(
      getSecurityTxtRedirectTarget({
        method: 'GET',
        url: 'https://portal.scs-pdn.space/.WELL-KNOWN/SECURITY.TXT',
      })
    ).toBe(SECURITY_TXT_CANONICAL_URL);
    expect(
      getSecurityTxtRedirectTarget({
        method: 'GET',
        url: 'https://portal.scs-pdn.space/security.txt',
      })
    ).toBe(SECURITY_TXT_CANONICAL_URL);
  });

  test('does not redirect unrelated paths or unsupported methods', () => {
    expect(
      getSecurityTxtRedirectTarget({
        method: 'GET',
        url: 'https://api.scs-pdn.space/api/me',
      })
    ).toBeUndefined();

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      expect(
        getSecurityTxtRedirectTarget({
          method,
          url: 'https://api.scs-pdn.space/security.txt',
        })
      ).toBeUndefined();
    }
  });
});
