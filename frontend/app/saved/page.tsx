'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/loading'
import { formatDate } from '@/lib/utils'
import type { SavedItem } from '@/lib/types'
import { ArrowLeft, BookOpen, Bookmark, Trash2 } from 'lucide-react'

export default function SavedPage() {
  const router = useRouter()
  const [items, setItems] = useState<SavedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    loadSavedItems()
  }, [])

  async function loadSavedItems() {
    try {
      const res = await fetch('/api/saved')
      const data = await res.json()
      if (data.items) {
        setItems(data.items)
      }
    } catch (error) {
      console.error('Error loading saved items:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(learnItemId: string) {
    setDeleting(learnItemId)
    try {
      await fetch(`/api/saved?learn_item_id=${learnItemId}`, { method: 'DELETE' })
      setItems(prev => prev.filter(item => item.learn_item_id !== learnItemId))
    } catch (error) {
      console.error('Error deleting:', error)
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Loading saved items..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container flex items-center justify-between h-14">
          <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Home
          </Button>
          <div className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-primary" />
            <span className="font-medium">Saved</span>
          </div>
          <div className="w-20" />
        </div>
      </header>

      <main className="container py-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Saved Items</h1>

        {items.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bookmark className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No saved items yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Bookmark learning cards to revisit them later
              </p>
              <Button onClick={() => router.push('/')}>
                Start Learning
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <Card 
                key={item.id} 
                className="cursor-pointer hover:border-primary/50 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div 
                      className="flex-1"
                      onClick={() => router.push(`/learn/${item.learn_item_id}`)}
                    >
                      <h3 className="font-medium">
                        {item.learn_item?.content?.title || 'Untitled'}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.learn_item?.topic}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Saved {formatDate(item.created_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(item.learn_item_id)
                      }}
                      disabled={deleting === item.learn_item_id}
                    >
                      {deleting === item.learn_item_id ? (
                        <LoadingSpinner className="h-4 w-4" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
