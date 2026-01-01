'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/loading'
import { formatDate } from '@/lib/utils'
import type { SavedItem, LearnItem, LessonPlan } from '@/lib/types'
import { ArrowLeft, BookOpen, Bookmark, GraduationCap, Trash2 } from 'lucide-react'

export default function SavedPage() {
  const router = useRouter()
  const [items, setItems] = useState<SavedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'learning' | 'lesson_plan'>('all')

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

  async function handleDelete(itemId: string, itemType: 'learning' | 'lesson_plan') {
    setDeleting(itemId)
    try {
      await fetch(`/api/saved?item_type=${itemType}&item_id=${itemId}`, { method: 'DELETE' })
      setItems(prev => prev.filter(item => !(item.item_id === itemId && item.item_type === itemType)))
    } catch (error) {
      console.error('Error deleting:', error)
    } finally {
      setDeleting(null)
    }
  }

  const filteredItems = items.filter(item => {
    if (activeTab === 'all') return true
    return item.item_type === activeTab
  })

  const learningCount = items.filter(i => i.item_type === 'learning').length
  const lessonPlanCount = items.filter(i => i.item_type === 'lesson_plan').length

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
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
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
        <h1 className="text-2xl font-bold mb-6 font-[family-name:var(--font-dm-sans)]">Saved Items</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button 
            variant={activeTab === 'all' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setActiveTab('all')}
          >
            All ({items.length})
          </Button>
          <Button 
            variant={activeTab === 'learning' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setActiveTab('learning')}
          >
            <BookOpen className="h-4 w-4 mr-1" />
            Learnings ({learningCount})
          </Button>
          <Button 
            variant={activeTab === 'lesson_plan' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setActiveTab('lesson_plan')}
          >
            <GraduationCap className="h-4 w-4 mr-1" />
            Lesson Plans ({lessonPlanCount})
          </Button>
        </div>

        {filteredItems.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              {activeTab === 'lesson_plan' ? (
                <>
                  <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">No lesson plans yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create a lesson plan from any learning card to see it here
                  </p>
                </>
              ) : (
                <>
                  <Bookmark className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">No saved items yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Bookmark learning cards to revisit them later
                  </p>
                </>
              )}
              <Button onClick={() => router.push('/')}>
                Start Learning
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredItems.map(item => {
              const isLearning = item.item_type === 'learning'
              const learnItem = item.learn_item as LearnItem | undefined
              const lessonPlan = item.lesson_plan as LessonPlan | undefined
              
              return (
                <Card 
                  key={item.id} 
                  className="card-interactive"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div 
                        className="flex-1 flex items-start gap-3 cursor-pointer"
                        onClick={() => {
                          if (isLearning && learnItem) {
                            router.push(`/learn/${learnItem.id}`)
                          } else if (lessonPlan) {
                            // For now, navigate to the linked learn item
                            if (lessonPlan.learn_item_id) {
                              router.push(`/learn/${lessonPlan.learn_item_id}`)
                            }
                          }
                        }}
                      >
                        <div className={`icon-badge ${isLearning ? '' : 'bg-accent'}`}>
                          {isLearning ? (
                            <BookOpen className="h-4 w-4 text-primary" />
                          ) : (
                            <GraduationCap className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium truncate">
                              {isLearning 
                                ? learnItem?.content?.title || 'Untitled'
                                : lessonPlan?.title || 'Untitled Plan'
                              }
                            </h3>
                            <span className="text-xs bg-muted px-2 py-0.5 rounded flex-shrink-0">
                              {isLearning ? 'Learning' : 'Lesson Plan'}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {isLearning ? learnItem?.topic : lessonPlan?.topic}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Saved {formatDate(item.created_at)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(item.item_id, item.item_type)
                        }}
                        disabled={deleting === item.item_id}
                      >
                        {deleting === item.item_id ? (
                          <LoadingSpinner className="h-4 w-4" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
