import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OpsWatch — AI DevOps Incident Triage',
  description:
    'Paste raw server logs and get AI-classified severity, root cause, business impact, and remediation steps in seconds.',
  openGraph: {
    title: 'OpsWatch — AI DevOps Incident Triage',
    description:
      'Paste raw server logs and get AI-classified severity, root cause, and remediation steps in seconds.',
    type: 'website',
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
