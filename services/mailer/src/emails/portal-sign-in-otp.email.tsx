import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from '@react-email/components';

import { EMAIL_COLORS } from '@/emails/email-theme';

export interface PortalSignInOtpEmailProps {
  otp: string;
  expiresInMinutes: number;
}

export function PortalSignInOtpEmail({
  otp,
  expiresInMinutes,
}: PortalSignInOtpEmailProps) {
  return (
    <Html lang="en">
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: { extend: { colors: EMAIL_COLORS } },
        }}
      >
        <Head />
        <Body className="bg-canvas text-ink m-0 px-4 py-8 font-sans">
          <Preview>Your SCS Portal sign-in code is {otp}</Preview>
          <Container
            className="border-border bg-surface mx-auto rounded-xl border
              border-solid px-8 py-8"
          >
            <Text className="text-brand m-0 text-sm font-semibold">
              SCS Portal
            </Text>
            <Heading as="h1" className="mt-4 mb-3 text-2xl font-semibold">
              Confirm your sign-in
            </Heading>
            <Text className="text-muted my-0 text-base leading-6">
              Your sign-in code is {otp}.
            </Text>
            <Section
              className="border-border bg-canvas my-6 rounded-lg border
                border-solid px-6 py-5 text-center"
            >
              <Text className="text-brand m-0 text-3xl font-bold tracking-[8px]">
                {otp}
              </Text>
            </Section>
            <Text className="text-muted my-0 text-sm leading-6">
              This code expires in {expiresInMinutes} minutes. If you did not
              request it, you can safely ignore this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

PortalSignInOtpEmail.PreviewProps = {
  otp: '123456',
  expiresInMinutes: 5,
} satisfies PortalSignInOtpEmailProps;
