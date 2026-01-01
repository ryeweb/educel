'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { LoadingSpinner } from '@/components/loading'
import type { LearnItem, LearnContent, TopicOption, UserPrefs, ExpandedContent, LessonPlan, LessonPlanContent } from '@/lib/types'
import { 
  ArrowLeft, 
  BookOpen, 
  Bookmark, 
  BookmarkCheck, 
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Lightbulb,
  Compass,
  Check,
  ExternalLink,
  GraduationCap,
  Link as LinkIcon,
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
  
  // Navigation state
  const [allItems, setAllItems] = useState<LearnItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  
  // Expanded content state - cached
  const [expandedContent, setExpandedContent] = useState<ExpandedContent | null>(null)
  const [loadingExpand, setLoadingExpand] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Lesson plan state - cached
  const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null)
  const [loadingLessonPlan, setLoadingLessonPlan] = useState(false)
  const [showLessonPlan, setShowLessonPlan] = useState(false)
  
  // Adjacent options state
  const [adjacentOptions, setAdjacentOptions] = useState<TopicOption[] | null>(null)
  const [loadingAdjacent, setLoadingAdjacent] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadItem()
    loadPrefs()
    checkIfSaved()
    loadAllItems()
  }, [resolvedParams.id])

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        navigateToPrev()
      } else if (e.key === 'ArrowRight' && currentIndex < allItems.length - 1) {
        navigateToNext()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, allItems])

  async function loadItem() {
    setLoading(true)
    setShowLessonPlan(false)
    setAdjacentOptions(null)
    setShowAnswer(false)
    
    try {
      const res = await fetch(`/api/learn?id=${resolvedParams.id}`)
      const data = await res.json()
      if (data.item) {
        setItem(data.item)
        
        // Check for cached expanded content
        if (data.item.expanded_content) {
          setExpandedContent(data.item.expanded_content)
          setIsExpanded(true)
        } else {
          setExpandedContent(null)
          setIsExpanded(false)
        }
        
        // Check for existing lesson plan
        checkExistingLessonPlan(resolvedParams.id)
      }
    } catch (error) {
      console.error('Error loading item:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadAllItems() {
    try {
      const res = await fetch('/api/learn?limit=50')
      const data = await res.json()
      if (data.items) {
        setAllItems(data.items)
        const idx = data.items.findIndex((i: LearnItem) => i.id === resolvedParams.id)
        setCurrentIndex(idx >= 0 ? idx : 0)
      }
    } catch (error) {
      console.error('Error loading items:', error)
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

  async function checkExistingLessonPlan(learnItemId: string) {
    try {
      const res = await fetch(`/api/lesson-plan?learn_item_id=${learnItemId}`)
      const data = await res.json()
      if (data.plan) {
        setLessonPlan(data.plan)
      } else {
        setLessonPlan(null)
      }
    } catch (error) {
      console.error('Error checking lesson plan:', error)
    }
  }

  async function toggleSave() {
    setSavingBookmark(true)
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
      }
    } catch (error) {
      console.error('Error toggling save:', error)
    } finally {
      setSavingBookmark(false)
    }
  }

  function navigateToPrev() {
    if (currentIndex > 0) {
      const prevItem = allItems[currentIndex - 1]
      router.push(`/learn/${prevItem.id}`)
    }
  }

  function navigateToNext() {
    if (currentIndex < allItems.length - 1) {
      const nextItem = allItems[currentIndex + 1]
      router.push(`/learn/${nextItem.id}`)
    }
  }

  async function handleLearnMore() {
    if (!prefs || !item || isExpanded) return
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

      // Save expanded content to learn_item for caching
      await fetch('/api/learn', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          expanded_content: cleanData,
        }),
      })

      setExpandedContent(cleanData)
      setIsExpanded(true)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoadingExpand(false)
    }
  }

  async function handleCreateLessonPlan() {
    if (!prefs || !item || lessonPlan) return
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

      // Save the lesson plan (auto-saves to saved_items)
      const saveRes = await fetch('/api/lesson-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learn_item_id: item.id,
          title: `Lesson Plan: ${item.content.title}`,
          topic: item.topic,
          content: cleanPlanData,
        }),
      })
      const saveData = await saveRes.json()
      
      if (saveData.plan) {
        setLessonPlan(saveData.plan)
        setShowLessonPlan(true)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoadingLessonPlan(false)
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

      const { _meta, ...cleanContent } = content

      const saveRes = await fetch('/api/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          source_type: 'adjacent',
          content: cleanContent,
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
  const planContent = lessonPlan?.content as LessonPlanContent | undefined

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex items-center justify-between h-14">
          <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Home
          </Button>
          
          {/* Navigation controls */}
          {allItems.length > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={navigateToPrev}
                disabled={currentIndex === 0}
                aria-label="Previous item"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                {currentIndex + 1} / {allItems.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={navigateToNext}
                disabled={currentIndex === allItems.length - 1}
                aria-label="Next item"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          )}
          
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
            <h1 className="text-2xl md:text-3xl font-bold mb-3 font-[family-name:var(--font-dm-sans)]">{content.title}</h1>
            <p className="text-lg text-muted-foreground mb-6">{content.hook}</p>

            <Separator className="my-6" />

            {/* Bullets */}
            <div className="space-y-4 mb-6">
              {content.bullets.map((bullet, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
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
                <Lightbulb className="h-4 w-4 text-primary" />
                Example
              </h3>
              <p className="text-sm">{content.example}</p>
            </div>

            {/* Micro-action */}
            <div className="bg-accent/50 border border-primary/20 rounded-lg p-4 mb-6">
              <h3 className="font-medium mb-2">Try this today</h3>
              <p className="text-sm">{content.micro_action}</p>
            </div>

            {/* Sources - only show if available */}
            {content.sources && content.sources.length > 0 && (
              <div className="border-t pt-6">
                <h3 className="font-medium mb-3 flex items-center gap-2 text-sm">
                  <LinkIcon className="h-4 w-4" />
                  Suggested starting points
                </h3>
                <div className="space-y-2">
                  {content.sources.map((source, i) => (
                    <a
                      key={i}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{source.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Expanded Content Section - persisted */}
            {isExpanded && expandedContent && (
              <div className="border-t pt-6 mt-6 animate-in">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 font-[family-name:var(--font-dm-sans)]">
                  <ChevronDown className="h-5 w-5 text-primary" />
                  Deep Dive
                </h3>
                <div className="space-y-4 text-sm leading-relaxed">
                  {expandedContent.paragraphs.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
                {expandedContent.additional_bullets && expandedContent.additional_bullets.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h4 className="font-medium">Advanced Insights</h4>
                    {expandedContent.additional_bullets.map((bullet, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="h-5 w-5 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-3 w-3" />
                        </div>
                        <p className="text-sm">{bullet}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quiz toggle */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="quiz-toggle">Quiz me</Label>
              <Switch 
                id="quiz-toggle" 
                checked={showQuiz} 
                onCheckedChange={setShowQuiz} 
              />
            </div>
            
            {showQuiz && (
              <div className="mt-4 pt-4 border-t animate-in">
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

        {/* Lesson Plan Display - persisted */}
        {showLessonPlan && lessonPlan && planContent && (
          <Card className="mb-6 animate-in">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg font-[family-name:var(--font-dm-sans)]">Your Lesson Plan</h3>
                <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full ml-auto">
                  Auto-saved
                </span>
              </div>
              
              {/* Goals */}
              <div className="mb-6">
                <h4 className="font-medium mb-2">Learning Goals</h4>
                <ul className="space-y-2">
                  {planContent.goals.map((goal, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-primary font-medium">{i + 1}.</span>
                      {goal}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Resources */}
              <div className="mb-6">
                <h4 className="font-medium mb-2">Resources ({planContent.resources.length})</h4>
                <div className="space-y-2">
                  {planContent.resources.slice(0, 5).map((resource, i) => (
                    <a
                      key={i}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{resource.title}</span>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">{resource.type}</span>
                    </a>
                  ))}
                </div>
              </div>

              {/* Exercises */}
              <div className="mb-6">
                <h4 className="font-medium mb-2">Exercises</h4>
                <ul className="space-y-2">
                  {planContent.exercises.map((exercise, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-muted-foreground mt-0.5" />
                      {exercise}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Daily Plan Preview */}
              <div>
                <h4 className="font-medium mb-2">{planContent.daily_plan.length}-Day Plan</h4>
                <div className="grid gap-2">
                  {planContent.daily_plan.slice(0, 7).map((day, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm p-2 rounded bg-muted/30">
                      <span className="font-medium text-primary w-12">Day {day.day}</span>
                      <span className="text-muted-foreground">{day.focus}</span>
                    </div>
                  ))}
                  {planContent.daily_plan.length > 7 && (
                    <p className="text-xs text-muted-foreground">
                      + {planContent.daily_plan.length - 7} more days...
                    </p>
                  )}
                </div>
              </div>

              <Button 
                variant="ghost" 
                className="w-full mt-4"
                onClick={() => setShowLessonPlan(false)}
              >
                Hide lesson plan
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          {!isExpanded ? (
            <Button 
              className="w-full" 
              size="lg"
              onClick={handleLearnMore}
              disabled={loadingExpand}
            >
              {loadingExpand ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : (
                <>
                  Learn more
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => lessonPlan ? setShowLessonPlan(true) : handleCreateLessonPlan()}
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
                  Create a Lesson Plan
                </>
              )}
            </Button>
          )}

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
