'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/loading'
import { NavMenu } from '@/components/nav-menu'
import { formatDate } from '@/lib/utils'
import type { SavedItem, LearnItem, LessonPlan } from '@/lib/types'
import { ArrowLeft, BookOpen, Bookmark, GraduationCap, Trash2, Lightbulb, FileText } from 'lucide-react'

export default function SavedPage() {
  const router = useRouter()
  const [items, setItems] = useState<SavedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'ideas' | 'articles' | 'lesson_plan'>('all')
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined)

  const supabase = createClient()

  useEffect(() => {
    loadSavedItems()
    loadUser()
  }, [])

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserEmail(user?.email)
  }

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
    if (activeTab === 'ideas') {
      // Ideas: learning items WITHOUT expanded content
      return item.item_type === 'learning' && !item.learn_item?.expanded_content
    }
    if (activeTab === 'articles') {
      // Articles: learning items WITH expanded content
      return item.item_type === 'learning' && item.learn_item?.expanded_content
    }
    if (activeTab === 'lesson_plan') {
      return item.item_type === 'lesson_plan'
    }
    return false
  })

  const ideasCount = items.filter(i => i.item_type === 'learning' && !i.learn_item?.expanded_content).length
  const articlesCount = items.filter(i => i.item_type === 'learning' && i.learn_item?.expanded_content).length
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
          <NavMenu userEmail={userEmail} />
        </div>
      </header>

      <main className="container py-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 font-[family-name:var(--font-dm-sans)]">Saved Items</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <Button
            variant={activeTab === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('all')}
          >
            All ({items.length})
          </Button>
          <Button
            variant={activeTab === 'ideas' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('ideas')}
          >
            <Lightbulb className="h-4 w-4 mr-1" />
            Ideas ({ideasCount})
          </Button>
          <Button
            variant={activeTab === 'articles' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('articles')}
          >
            <FileText className="h-4 w-4 mr-1" />
            Articles ({articlesCount})
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
              {activeTab === 'ideas' ? (
                <>
                  <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">No ideas saved yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Save learning cards to build your idea collection
                  </p>
                </>
              ) : activeTab === 'articles' ? (
                <>
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">No articles saved yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate and save in-depth articles to read later
                  </p>
                </>
              ) : activeTab === 'lesson_plan' ? (
                <>
                  <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">No lesson plans yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create a lesson plan from any article to see it here
                  </p>
                </>
              ) : (
                <>
                  <Bookmark className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">No saved items yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Save ideas, articles, and lesson plans to revisit them later
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
                            // Navigate to article if it has expanded content, otherwise to learning card
                            if (learnItem.expanded_content) {
                              router.push(`/learn/${learnItem.id}/article`)
                            } else {
                              router.push(`/learn/${learnItem.id}`)
                            }
                          } else if (lessonPlan) {
                            router.push(`/lesson-plan/${lessonPlan.id}`)
                          }
                        }}
                      >
                        <div className={`icon-badge ${isLearning ? '' : 'bg-accent'}`}>
                          {isLearning ? (
                            learnItem?.expanded_content ? (
                              <FileText className="h-4 w-4 text-primary" />
                            ) : (
                              <Lightbulb className="h-4 w-4 text-primary" />
                            )
                          ) : (
                            <GraduationCap className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-base line-clamp-2 mb-1">
                            {isLearning
                              ? learnItem?.content?.title || 'Untitled'
                              : lessonPlan?.topic || 'Untitled'
                            }
                          </h3>
                          {isLearning && (
                            <p className="text-sm text-muted-foreground mt-1 truncate">
                              {learnItem?.topic}
                            </p>
                          )}
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
