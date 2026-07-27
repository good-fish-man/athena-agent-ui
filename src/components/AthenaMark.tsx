import React from 'react';

interface AthenaMarkProps extends React.SVGProps<SVGSVGElement> {
  title?: string;
}

// Athena-inspired mark: a crested helmet framing the focused eyes of an owl.
export function AthenaMark({ title = 'Athena', ...props }: AthenaMarkProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" role="img" aria-label={title} {...props}>
      <path d="M24 4c7.9 0 14.5 5.2 16.7 12.4l-6.1-2.2C32.1 10.5 28.4 8.5 24 8.5s-8.1 2-10.6 5.7l-6.1 2.2C9.5 9.2 16.1 4 24 4Z" fill="currentColor" opacity=".45" />
      <path d="M24 7.5v7.2M19.6 8.2 24 14.7l4.4-6.5" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.2 17.8 15 15.2h18l6.8 2.6-3.1 18.5L24 43 11.3 36.3 8.2 17.8Z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
      <path d="m13.1 22.2 7.7 2.1L24 29l3.2-4.7 7.7-2.1-3 9.6-7.9 5.4-7.9-5.4-3-9.6Z" fill="currentColor" opacity=".18" />
      <path d="m13.1 22.2 7.7 2.1L24 29l3.2-4.7 7.7-2.1M16.1 31.8l7.9 5.4 7.9-5.4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="19.2" cy="27.2" r="2.1" fill="currentColor" />
      <circle cx="28.8" cy="27.2" r="2.1" fill="currentColor" />
      <path d="m24 29-2.1 3.1H26L24 29Z" fill="currentColor" />
    </svg>
  );
}
