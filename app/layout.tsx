import type { Metadata, Viewport } from "next"
import { Geist, Instrument_Serif } from "next/font/google"
import "./globals.css"
import AppShell from "./components/AppShell"
import { AuthProvider } from "@/lib/auth"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

// Serif for page titles — matches the "Summer Plans" / "Calendar" headings.
const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
})

export const metadata: Metadata = {
  title: "Summer Plans",
  description: "Friend group coordination for summer 2026",
  // Tells iOS Safari to render in fullscreen when launched from the home screen.
  appleWebApp: {
    capable: true,
    title: 'Summer Plans',
    statusBarStyle: 'default',
  },
}

// Lock the viewport so iOS doesn't pinch-zoom or pan during gestures, and
// extend the layout edge-to-edge under the home indicator and notch.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#FCFAF6',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${instrumentSerif.variable} h-full`}>
      <body className="min-h-full bg-sand text-ink antialiased">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  )
}
