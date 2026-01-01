'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  className?: string
  text?: string
}

export function LoadingSpinner({ className, text }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 className={cn('h-8 w-8 animate-spin text-muted-foreground', className)} />
      {text && <p className="text-sm text-muted-foreground animate-pulse">{text}</p>}
    </div>
  )
}

export function LoadingCard() {
  return (
    <div className="rounded-lg border bg-card p-6 animate-pulse">
      <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
      <div className="h-3 bg-muted rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-muted rounded w-5/6"></div>
    </div>
  )
}

export function TopicCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-5 animate-pulse">
      <div className="h-5 bg-muted rounded w-2/3 mb-3"></div>
      <div className="h-3 bg-muted rounded w-full mb-2"></div>
      <div className="h-3 bg-muted rounded w-1/4 mt-3"></div>
    </div>
  )
}
