'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { LoadingSpinner } from '@/components/loading'
import { ActionButtons } from '@/components/action-buttons'
import { NavMenu } from '@/components/nav-menu'
import { AIDisclaimer } from '@/components/ai-disclaimer'
import type { LearnItem, LearnContent, UserPrefs, ExpandedContent, LessonPlan } from '@/lib/types'
import { EVENT_TYPES } from '@/lib/discovery'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  GraduationCap,
  BookOpen,
} from 'lucide-react'

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [item, setItem] = useState<LearnItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState<UserPrefs | null>(null)
  const [expandedContent, setExpandedContent] = useState<ExpandedContent | null>(null)
  const [loadingExpand, setLoadingExpand] = useState(false)
  const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null)
  const [loadingLessonPlan, setLoadingLessonPlan] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined)

  const supabase = createClient()

  useEffect(() => {
    loadItem()
    loadPrefs()
    checkExistingLessonPlan()
    checkIfSaved()
    loadUser()
  }, [resolvedParams.id])

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserEmail(user?.email)
  }

  async function loadItem() {
    setLoading(true)

    try {
      const res = await fetch(`/api/learn?id=${resolvedParams.id}`)
      const data = await res.json()
      if (data.item) {
        setItem(data.item)

        // Check for cached expanded content
        if (data.item.expanded_content) {
          setExpandedContent(data.item.expanded_content)
        }
      }
    } catch (error) {
      console.error('Error loading item:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadPrefs() {
    try {
      const res = await fetch('/api/prefs')
      const data = await res.json()
      if (data.prefs) {
        setPrefs(data.prefs)
      }
    } catch (error) {
      console.error('Error loading prefs:', error)
    }
  }

  async function checkExistingLessonPlan() {
    try {
      const res = await fetch(`/api/lesson-plan?learn_item_id=${resolvedParams.id}`)
      const data = await res.json()
      if (data.plan) {
        setLessonPlan(data.plan)
      }
    } catch (error) {
      console.error('Error checking lesson plan:', error)
    }
  }

  async function checkIfSaved() {
    try {
      const res = await fetch('/api/saved?item_type=learning')
      const data = await res.json()
      if (data.items) {
        const saved = data.items.some((s: { item_id: string }) => s.item_id === resolvedParams.id)
        setIsSaved(saved)
      }
    } catch (error) {
      console.error('Error checking saved:', error)
    }
  }

  async function toggleSave() {
    try {
      if (isSaved) {
        await fetch(`/api/saved?item_type=learning&item_id=${resolvedParams.id}`, { method: 'DELETE' })
        setIsSaved(false)
      } else {
        await fetch('/api/saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_type: 'learning', item_id: resolvedParams.id }),
        })
        setIsSaved(true)

        // Log saved event
        if (item) {
          fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_type: EVENT_TYPES.SAVED,
              topic: item.topic,
              learn_item_id: item.id,
            }),
          }).catch(e => console.error('Event logging failed:', e))
        }
      }
    } catch (error) {
      console.error('Error toggling save:', error)
    }
  }

  function handleShare() {
    const url = `${window.location.origin}/learn/${resolvedParams.id}/article`
    const title = item?.content?.title || 'Article'

    if (navigator.share) {
      navigator.share({
        title,
        url,
      }).catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Error sharing:', error)
        }
      })
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(url)
      alert('Link copied to clipboard!')
    }
  }

  async function handleGenerateArticle() {
    if (!prefs || !item || expandedContent) return
    setLoadingExpand(true)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'expand_content',
          preferred_topics: prefs.preferred_topics,
          depth: prefs.depth,
          topic: item.topic,
          prior_item: item.content,
        }),
      })
      const data = await res.json()

      if (data.error) {
        console.error('Error:', data.error)
        return
      }

      // Remove _meta if present
      const { _meta, ...cleanData } = data

      // Save expanded content to learn_item for caching (including one_line_takeaway in column)
      const patchRes = await fetch('/api/learn', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          expanded_content: cleanData,
          one_line_takeaway: cleanData.one_line_takeaway,
        }),
      })

      const patchData = await patchRes.json()

      if (!patchRes.ok) {
        console.error('Failed to save article:', patchData.error)
        alert('Article generated but failed to save. Please try again.')
        return
      }

      console.log('Article saved successfully:', patchData)
      setExpandedContent(cleanData)

      // Update item with saved data
      setItem(patchData.item)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoadingExpand(false)
    }
  }

  async function handleCreateLessonPlan() {
    if (!prefs || !item) return
    setLoadingLessonPlan(true)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'lesson_plan',
          preferred_topics: prefs.preferred_topics,
          depth: prefs.depth,
          topic: item.topic,
          prior_item: item.content,
        }),
      })
      const planData = await res.json()

      if (planData.error) {
        console.error('Error:', planData.error)
        return
      }

      // Remove _meta if present
      const { _meta, ...cleanPlanData } = planData

      // Save the lesson plan
      const saveRes = await fetch('/api/lesson-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learn_item_id: item.id,
          topic: item.topic,
          content: cleanPlanData,
        }),
      })
      const saveData = await saveRes.json()

      if (saveData.plan) {
        // Log lesson plan generation event
        fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: EVENT_TYPES.PLAN_GENERATED,
            topic: item.topic,
            learn_item_id: item.id,
          }),
        }).catch(e => console.error('Event logging failed:', e))

        // Navigate to the lesson plan page
        router.push(`/lesson-plan/${saveData.plan.id}`)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoadingLessonPlan(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Loading..." />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Item not found</h2>
          <Button variant="ghost" onClick={() => router.push('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  const content = item.content as LearnContent

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex items-center justify-between h-14">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/learn/${item.id}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Learning Card
          </Button>

          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-medium">Article</span>
          </div>

          <NavMenu userEmail={userEmail} />
        </div>
      </header>

      <main className="container py-8 max-w-3xl mx-auto pb-32">
        {/* Learning card summary */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h1 className="text-2xl font-bold mb-3 font-[family-name:var(--font-dm-sans)]">{content.title}</h1>
            <p className="text-muted-foreground mb-4">{content.hook}</p>

            <Separator className="my-4" />

            <div className="space-y-2">
              {content.bullets.map((bullet, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{bullet}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Expanded content */}
        {expandedContent ? (
          <Card className="mb-6">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-xl font-semibold mb-6 font-[family-name:var(--font-dm-sans)]">Deep Dive</h2>

              <div className="prose prose-sm max-w-none">
                <div className="space-y-4 leading-relaxed">
                  {expandedContent.paragraphs.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>

                {expandedContent.additional_bullets && expandedContent.additional_bullets.length > 0 && (
                  <div className="mt-8 not-prose">
                    <h3 className="font-semibold text-lg mb-4">Advanced Insights</h3>
                    <div className="space-y-3">
                      {expandedContent.additional_bullets.map((bullet, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="h-5 w-5 rounded-full bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="h-3 w-3 text-primary" />
                          </div>
                          <p className="text-sm">{bullet}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-6">
            <CardContent className="p-8 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">Generate In-Depth Article</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get a comprehensive deep dive with advanced insights and detailed explanations
              </p>
              <Button
                onClick={handleGenerateArticle}
                disabled={loadingExpand}
                className={loadingExpand ? 'relative overflow-hidden' : ''}
              >
                {loadingExpand ? (
                  <span className="relative inline-block">
                    <span className="shimmer-text">Generating...</span>
                  </span>
                ) : (
                  'Generate Article'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          {expandedContent && (
            <Button
              className="w-full"
              size="lg"
              onClick={() => lessonPlan ? router.push(`/lesson-plan/${lessonPlan.id}`) : handleCreateLessonPlan()}
              disabled={loadingLessonPlan}
            >
              {loadingLessonPlan ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : lessonPlan ? (
                <>
                  <GraduationCap className="h-4 w-4 mr-2" />
                  View Lesson Plan
                </>
              ) : (
                <>
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Create Lesson Plan
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          )}
        </div>

        {/* AI Disclaimer */}
        <div className="mt-8">
          <AIDisclaimer />
        </div>

        {/* Action Buttons */}
        <ActionButtons
          isSaved={isSaved}
          onSave={toggleSave}
          onShare={handleShare}
          itemTitle={content.title}
          itemUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/learn/${item.id}/article`}
        />
      </main>
    </div>
  )
}
