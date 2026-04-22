'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useName } from '@/lib/useName'

const FRIENDS = [
  'Tad', 'Grace', 'Liam', 'Mcguire', 'Carter', 'Storm',
  'Megan', 'Margaret', 'Mary Hannah', 'Jonah', 'Katie', 'Eston & Irelynn',
]

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function TopBar() {
  const [name, setName] = useName()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
      <div className="max-w-md mx-auto px-5 h-14 flex items-center justify-between">
        <Link href="/" className="font-black text-gray-900 tracking-tight text-lg">
          ☀️ Summer Plans
        </Link>

        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
              name
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
          >
            {name ? (
              <>
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold leading-none">
                  {initials(name)}
                </span>
                <span className="max-w-[100px] truncate">{name}</span>
              </>
            ) : (
              <span>Who are you?</span>
            )}
            <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 overflow-hidden">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pt-1 pb-2">Select your name</p>
              {FRIENDS.map((f) => (
                <button
                  key={f}
                  onClick={() => { setName(f); setOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2.5 ${
                    name === f
                      ? 'bg-gray-900 text-white font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    name === f ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {initials(f)}
                  </span>
                  {f}
                  {name === f && <span className="ml-auto text-xs opacity-60">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
