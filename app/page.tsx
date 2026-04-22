import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex flex-col">
      {/* Nav cards */}
      <div className="flex-1 px-5 pt-6 pb-10 max-w-md w-full mx-auto flex flex-col gap-3">
        <Link
          href="/availability"
          className="group flex items-center gap-4 p-5 rounded-2xl bg-white border border-blue-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
            📅
          </div>
          <div>
            <div className="font-bold text-gray-900">Availability</div>
            <div className="text-sm text-gray-500 mt-0.5">Mark your blackout dates &amp; see the group</div>
          </div>
          <div className="ml-auto text-gray-300 text-lg">›</div>
        </Link>

        <Link
          href="/events"
          className="group flex items-center gap-4 p-5 rounded-2xl bg-white border border-purple-100 shadow-sm hover:shadow-md hover:border-purple-200 transition-all active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
            🗳️
          </div>
          <div>
            <div className="font-bold text-gray-900">Event Voting</div>
            <div className="text-sm text-gray-500 mt-0.5">Vote on dates for upcoming events</div>
          </div>
          <div className="ml-auto text-gray-300 text-lg">›</div>
        </Link>

        <Link
          href="/ideas"
          className="group flex items-center gap-4 p-5 rounded-2xl bg-white border border-green-100 shadow-sm hover:shadow-md hover:border-green-200 transition-all active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
            💡
          </div>
          <div>
            <div className="font-bold text-gray-900">Ideas Hub</div>
            <div className="text-sm text-gray-500 mt-0.5">Suggest &amp; browse activity ideas</div>
          </div>
          <div className="ml-auto text-gray-300 text-lg">›</div>
        </Link>
      </div>

      {/* Footer */}
      <div className="text-center pb-8 text-xs text-gray-300 font-medium tracking-wide uppercase">
        The crew • Summer 2026
      </div>
    </main>
  )
}
