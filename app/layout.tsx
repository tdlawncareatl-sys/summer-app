import type { Metadata } from "next"
import { Geist, Instrument_Serif } from "next/font/google"
import "./globals.css"
import BottomNav from "./components/BottomNav"

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
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${instrumentSerif.variable} h-full`}>
      <body className="min-h-full bg-sand text-ink antialiased">
        {/* Leave room for the floating bottom nav. */}
        <div className="min-h-screen pb-28">{children}</div>
        <BottomNav />
      </body>
    </html>
  )
}
