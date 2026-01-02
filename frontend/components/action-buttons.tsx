'use client'

import { Button } from '@/components/ui/button'
import { Bookmark, BookmarkCheck, Share2, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useState } from 'react'

interface ActionButtonsProps {
  isSaved: boolean
  onSave: () => Promise<void>
  onShare: () => void
  itemTitle: string
  itemUrl: string
}

export function ActionButtons({ isSaved, onSave, onShare, itemTitle, itemUrl }: ActionButtonsProps) {
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed bottom-6 left-0 right-0 z-20 pointer-events-none">
      <div className="container max-w-2xl mx-auto px-4">
        <div className="bg-card/95 backdrop-blur-sm border rounded-full shadow-lg p-3 pointer-events-auto">
          <div className="flex items-center justify-around gap-2">
            {/* Save Button */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-12 w-12 hover:bg-primary hover:text-primary-foreground"
              onClick={handleSave}
              disabled={saving}
              title={isSaved ? 'Saved' : 'Save'}
            >
              {isSaved ? (
                <BookmarkCheck className="h-5 w-5" />
              ) : (
                <Bookmark className="h-5 w-5" />
              )}
            </Button>

            {/* Share Button */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-12 w-12 hover:bg-primary hover:text-primary-foreground"
              onClick={onShare}
              title="Share"
            >
              <Share2 className="h-5 w-5" />
            </Button>

            {/* Relevant Button (Placeholder) */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-12 w-12 opacity-50 cursor-not-allowed"
              disabled
              title="Rate as relevant (coming soon)"
            >
              <ThumbsUp className="h-5 w-5" />
            </Button>

            {/* Show Less Button (Placeholder) */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-12 w-12 opacity-50 cursor-not-allowed"
              disabled
              title="Show less like this (coming soon)"
            >
              <ThumbsDown className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
