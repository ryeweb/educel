'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { LoadingSpinner, TopicCardSkeleton } from '@/components/loading'
import type { LearnItem, LearnContent, TopicOption, UserPrefs } from '@/lib/types'
import { 
  ArrowLeft, 
  BookOpen, 
  Bookmark, 
  BookmarkCheck, 
  ChevronRight, 
  Lightbulb,
  Compass,
  Check
} from 'lucide-react'

export default function LearnPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [item, setItem] = useState<LearnItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState<UserPrefs | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [savingBookmark, setSavingBookmark] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [adjacentOptions, setAdjacentOptions] = useState<TopicOption[] | null>(null)
  const [loadingAdjacent, setLoadingAdjacent] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadItem()
    loadPrefs()
    checkIfSaved()
  }, [resolvedParams.id])

  async function loadItem() {
    setLoading(true)
    try {
      const res = await fetch(`/api/learn?id=${resolvedParams.id}`)
      const data = await res.json()
      if (data.item) {
        setItem(data.item)
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

  async function checkIfSaved() {
    try {
      const res = await fetch('/api/saved')
      const data = await res.json()
      if (data.items) {
        const saved = data.items.some((s: any) => s.learn_item_id === resolvedParams.id)
        setIsSaved(saved)
      }
    } catch (error) {
      console.error('Error checking saved:', error)
    }
  }

  async function toggleSave() {
    setSavingBookmark(true)
    try {
      if (isSaved) {
        await fetch(`/api/saved?learn_item_id=${resolvedParams.id}`, { method: 'DELETE' })
        setIsSaved(false)
      } else {
        await fetch('/api/saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ learn_item_id: resolvedParams.id }),
        })
        setIsSaved(true)
      }
    } catch (error) {
      console.error('Error toggling save:', error)
    } finally {
      setSavingBookmark(false)
    }
  }

  async function handleLearnMore() {
    if (!prefs || !item) return
    setLoadingMore(true)
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'learn_more',
          preferred_topics: prefs.preferred_topics,
          depth: prefs.depth,
          topic: item.topic,
          prior_item: item.content,
        }),
      })
      const content = await res.json()
      
      if (content.error) {
        console.error('Error:', content.error)
        return
      }

      const saveRes = await fetch('/api/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: item.topic,
          source_type: 'learn_more',
          content,
        }),
      })
      const saveData = await saveRes.json()
      
      if (saveData.item) {
        router.push(`/learn/${saveData.item.id}`)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleExploreAdjacent() {
    if (!prefs || !item) return
    setLoadingAdjacent(true)
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'adjacent_options',
          preferred_topics: prefs.preferred_topics,
          depth: prefs.depth,
          topic: item.topic,
        }),
      })
      const data = await res.json()
      
      if (data.options) {
        setAdjacentOptions(data.options)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoadingAdjacent(false)
    }
  }

  async function selectAdjacentTopic(topic: string) {
    if (!prefs) return
    setLoadingAdjacent(true)
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'learn_item',
          preferred_topics: prefs.preferred_topics,
          depth: prefs.depth,
          topic,
        }),
      })
      const content = await res.json()
      
      if (content.error) {
        console.error('Error:', content.error)
        return
      }

      const saveRes = await fetch('/api/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          source_type: 'adjacent',
          content,
        }),
      })
      const saveData = await saveRes.json()
      
      if (saveData.item) {
        router.push(`/learn/${saveData.item.id}`)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoadingAdjacent(false)
      setAdjacentOptions(null)
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
      <header className="border-b">
        <div className="container flex items-center justify-between h-14">
          <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Home
          </Button>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-medium">Educel</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleSave}
            disabled={savingBookmark}
          >
            {isSaved ? (
              <BookmarkCheck className="h-5 w-5 text-primary" />
            ) : (
              <Bookmark className="h-5 w-5" />
            )}
          </Button>
        </div>
      </header>

      <main className="container py-8 max-w-2xl mx-auto">
        {/* Main content card */}
        <Card className="mb-6">
          <CardContent className="p-6 md:p-8">
            {/* Title & Hook */}
            <h1 className="text-2xl md:text-3xl font-bold mb-3">{content.title}</h1>
            <p className="text-lg text-muted-foreground mb-6">{content.hook}</p>

            <Separator className="my-6" />

            {/* Bullets */}
            <div className="space-y-4 mb-6">
              {content.bullets.map((bullet, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <p>{bullet}</p>
                </div>
              ))}
            </div>

            <Separator className="my-6" />

            {/* Example */}
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Example
              </h3>
              <p className="text-sm">{content.example}</p>
            </div>

            {/* Micro-action */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <h3 className="font-medium mb-2">Try this today</h3>
              <p className="text-sm">{content.micro_action}</p>
            </div>
          </CardContent>
        </Card>

        {/* Quiz toggle */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="quiz-toggle">Quiz me</Label>
              </div>
              <Switch 
                id="quiz-toggle" 
                checked={showQuiz} 
                onCheckedChange={setShowQuiz} 
              />
            </div>
            
            {showQuiz && (
              <div className="mt-4 pt-4 border-t">
                <p className="font-medium mb-3">{content.quiz_question}</p>
                {showAnswer ? (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm">{content.quiz_answer}</p>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowAnswer(true)}
                  >
                    Show answer
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="space-y-3">
          <Button 
            className="w-full" 
            size="lg"
            onClick={handleLearnMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <LoadingSpinner className="h-4 w-4" />
            ) : (
              <>
                Learn more
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>

          {adjacentOptions ? (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Compass className="h-4 w-4" />
                  Explore adjacent topics
                </h3>
                <div className="space-y-2">
                  {adjacentOptions.map((option, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3 px-4"
                      onClick={() => selectAdjacentTopic(option.topic)}
                      disabled={loadingAdjacent}
                    >
                      <div>
                        <p className="font-medium">{option.topic}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{option.hook}</p>
                      </div>
                    </Button>
                  ))}
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full mt-2"
                  onClick={() => setAdjacentOptions(null)}
                >
                  Cancel
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Button 
              variant="outline" 
              className="w-full" 
              size="lg"
              onClick={handleExploreAdjacent}
              disabled={loadingAdjacent}
            >
              {loadingAdjacent ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : (
                <>
                  <Compass className="h-4 w-4 mr-2" />
                  Explore adjacent
                </>
              )}
            </Button>
          )}
        </div>
      </main>
    </div>
  )
}
