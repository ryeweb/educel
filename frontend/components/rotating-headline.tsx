'use client'

import { useState, useEffect } from 'react'
import { ROTATING_HEADLINES } from '@/lib/types'

export function RotatingHeadline() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (prefersReducedMotion) return

    const interval = setInterval(() => {
      setIsVisible(false)
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % ROTATING_HEADLINES.length)
        setIsVisible(true)
      }, 300)
    }, 6000)

    return () => clearInterval(interval)
  }, [prefersReducedMotion])

  if (prefersReducedMotion) {
    return (
      <h2 className="text-2xl font-semibold mb-1">
        {ROTATING_HEADLINES[0]}
      </h2>
    )
  }

  return (
    <h2 
      className={`text-2xl font-semibold mb-1 transition-all duration-300 ease-in-out ${
        isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 -translate-y-2'
      }`}
    >
      {ROTATING_HEADLINES[currentIndex]}
    </h2>
  )
}
