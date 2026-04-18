import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Roblox R6 AI Animator',
  description:
    'AI-powered animation studio for Roblox R6 characters. Text-to-animation, image-to-pose, and smooth SLERP interpolation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
