'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/loading'
import { ActionButtons } from '@/components/action-buttons'
import { NavMenu } from '@/components/nav-menu'
import type { LessonPlan } from '@/lib/types'
import {
  ArrowLeft,
  GraduationCap,
  Check,
  ExternalLink,
} from 'lucide-react'

export default function LessonPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [plan, setPlan] = useState<LessonPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSaved, setIsSaved] = useState(false)
  const [savingBookmark, setSavingBookmark] = useState(false)
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined)

  const supabase = createClient()

  useEffect(() => {
    loadPlan()
    checkIfSaved()
    loadUser()
  }, [resolvedParams.id])

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserEmail(user?.email)
  }

  async function loadPlan() {
    setLoading(true)

    try {
      const res = await fetch(`/api/lesson-plan?id=${resolvedParams.id}`)
      const data = await res.json()
      if (data.plan) {
        setPlan(data.plan)
      }
    } catch (error) {
      console.error('Error loading plan:', error)
    } finally {
      setLoading(false)
    }
  }

  async function checkIfSaved() {
    try {
      const res = await fetch('/api/saved?item_type=lesson_plan')
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
        await fetch(`/api/saved?item_type=lesson_plan&item_id=${resolvedParams.id}`, { method: 'DELETE' })
        setIsSaved(false)
      } else {
        await fetch('/api/saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_type: 'lesson_plan', item_id: resolvedParams.id }),
        })
        setIsSaved(true)
      }
    } catch (error) {
      console.error('Error toggling save:', error)
    }
  }

  function handleShare() {
    const url = `${window.location.origin}/lesson-plan/${resolvedParams.id}`
    const title = plan?.topic || 'Lesson Plan'

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Loading..." />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Lesson plan not found</h2>
          <Button variant="ghost" onClick={() => router.push('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex items-center justify-between h-14">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (plan.learn_item_id) {
                router.push(`/learn/${plan.learn_item_id}/article`)
              } else {
                router.push('/')
              }
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="font-medium">Lesson Plan</span>
          </div>

          <NavMenu userEmail={userEmail} />
        </div>
      </header>

      <main className="container py-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 font-[family-name:var(--font-dm-sans)]">
            {plan.topic}
          </h1>
          <p className="text-muted-foreground">
            Your structured learning path
          </p>
        </div>

        {/* Learning Goals */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4 font-[family-name:var(--font-dm-sans)]">
              Learning Goals
            </h2>
            <ul className="space-y-3">
              {plan.goals.map((goal, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    {i + 1}
                  </span>
                  <p>{goal}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Resources */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4 font-[family-name:var(--font-dm-sans)]">
              Resources
            </h2>
            <div className="space-y-3">
              {plan.resources.slice(0, 5).map((resource, i) => (
                <a
                  key={i}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary hover:bg-accent/50 transition-colors"
                >
                  <ExternalLink className="h-4 w-4 flex-shrink-0 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{resource.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{resource.type}</p>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Exercises */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4 font-[family-name:var(--font-dm-sans)]">
              Practical Exercises
            </h2>
            <ul className="space-y-3">
              {plan.exercises.map((exercise, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p>{exercise}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Daily Plan */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4 font-[family-name:var(--font-dm-sans)]">
              {plan.daily_plan.length}-Day Learning Plan
            </h2>
            <div className="space-y-4">
              {plan.daily_plan.map((day, i) => (
                <div key={i} className="flex gap-4 p-4 rounded-lg border bg-muted/30">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                      {day.day}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-base mb-2">{day.focus}</h3>
                    <ul className="space-y-1">
                      {day.activities.map((activity, j) => (
                        <li key={j} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary">•</span>
                          {activity}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <ActionButtons
          isSaved={isSaved}
          onSave={toggleSave}
          onShare={handleShare}
          itemTitle={plan.topic}
          itemUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/lesson-plan/${plan.id}`}
        />
      </main>
    </div>
  )
}
