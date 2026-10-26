export const siteMetadataConfig = {
  applicationName: 'SCS PDN',
  description:
    'Teaching, research, facilities, services, and department information from the Department of Statistics & Computer Science, University of Peradeniya.',
  keywords: [
    'Department of Statistics and Computer Science',
    'University of Peradeniya',
    'Computer Science',
    'Statistics',
    'undergraduate study',
    'postgraduate study',
    'research',
  ],
  socialImage: {
    path: '/favicon/android-chrome-512x512.png',
    width: 512,
    height: 512,
    alt: 'Department of Statistics & Computer Science, University of Peradeniya',
  },
  title: {
    default: 'Department of Statistics & Computer Science',
    template: '%s | SCS PDN',
  },
} as const;
