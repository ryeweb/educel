'use client'

import { Button } from '@/components/ui/button'
import { Bookmark, BookmarkCheck, Share2, ThumbsUp, ThumbsDown, Sparkles } from 'lucide-react'
import { useState, useEffect } from 'react'

interface ActionButtonsProps {
  isSaved: boolean
  onSave: () => Promise<void>
  onShare: () => void
  itemTitle: string
  itemUrl: string
}

export function ActionButtons({ isSaved, onSave, onShare, itemTitle, itemUrl }: ActionButtonsProps) {
  const [saving, setSaving] = useState(false)
  const [showSparkles, setShowSparkles] = useState(false)

  async function handleSave() {
    setSaving(true)
    setShowSparkles(true)
    try {
      await onSave()
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (showSparkles) {
      const timer = setTimeout(() => setShowSparkles(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [showSparkles])

  return (
    <div className="fixed bottom-4 left-0 right-0 z-20 pointer-events-none">
      <div className="container max-w-3xl mx-auto px-4">
        <div className="bg-card/95 backdrop-blur-sm border rounded-full shadow-lg py-2 px-3 pointer-events-auto">
          <div className="flex items-center justify-around gap-1">
            {/* Save Button */}
            <Button
              variant="ghost"
              className="flex flex-col items-center gap-0.5 h-auto py-1.5 px-3 hover:bg-primary hover:text-primary-foreground rounded-full relative"
              onClick={handleSave}
              disabled={saving}
            >
              <div className="relative">
                {isSaved ? (
                  <BookmarkCheck className={`h-4 w-4 transition-transform ${showSparkles ? 'scale-110' : 'scale-100'}`} />
                ) : (
                  <Bookmark className={`h-4 w-4 transition-transform ${showSparkles ? 'scale-110' : 'scale-100'}`} />
                )}
                {showSparkles && (
                  <>
                    <Sparkles className="h-3 w-3 text-primary absolute -top-1 -right-1 animate-ping" />
                    <Sparkles className="h-2 w-2 text-primary absolute -bottom-1 -left-1 animate-pulse" />
                    <Sparkles className="h-2.5 w-2.5 text-primary absolute top-0 -left-2 animate-bounce" />
                  </>
                )}
              </div>
              <span className="text-[10px] leading-none">{isSaved ? 'Saved' : 'Save'}</span>
            </Button>

            {/* Share Button */}
            <Button
              variant="ghost"
              className="flex flex-col items-center gap-0.5 h-auto py-1.5 px-3 hover:bg-primary hover:text-primary-foreground rounded-full"
              onClick={onShare}
            >
              <Share2 className="h-4 w-4" />
              <span className="text-[10px] leading-none">Share</span>
            </Button>

            {/* Relevant Button (Placeholder) */}
            <Button
              variant="ghost"
              className="flex flex-col items-center gap-0.5 h-auto py-1.5 px-2 opacity-50 cursor-not-allowed rounded-full"
              disabled
              title="Rate as relevant (coming soon)"
            >
              <ThumbsUp className="h-4 w-4" />
            </Button>

            {/* Show Less Button (Placeholder) */}
            <Button
              variant="ghost"
              className="flex flex-col items-center gap-0.5 h-auto py-1.5 px-2 opacity-50 cursor-not-allowed rounded-full"
              disabled
              title="Show less like this (coming soon)"
            >
              <ThumbsDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
