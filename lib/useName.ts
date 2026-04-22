'use client'

import { useState, useEffect } from 'react'

const KEY = 'summer-app-name'

export function useName() {
  const [name, setNameState] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem(KEY)
    if (stored) setNameState(stored)
  }, [])

  function setName(n: string) {
    setNameState(n)
    localStorage.setItem(KEY, n)
  }

  return [name, setName] as const
}
