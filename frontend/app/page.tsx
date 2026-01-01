'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner, TopicCardSkeleton } from '@/components/loading'
import { RotatingHeadline } from '@/components/rotating-headline'
import { ThemeDropdown } from '@/components/theme-dropdown'
import { TopicIcon } from '@/components/topic-icon'
import { MoreHorizontal, BookOpen, Sparkles, Send, Settings, Bookmark, LogOut, ArrowRight } from 'lucide-react'
import { useTheme } from 'next-themes'
import type { UserPrefs, TopicOption, ClarifyResponse, LearnItem } from '@/lib/types'
import { formatDate } from '@/lib/utils'

export default function HomePage() {
  const router = useRouter()
  const { setTheme } = useTheme()
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [prefs, setPrefs] = useState<UserPrefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [topicOptions, setTopicOptions] = useState<TopicOption[]>([])
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [teachInput, setTeachInput] = useState('')
  const [loadingTeach, setLoadingTeach] = useState(false)
  const [clarifyMode, setClarifyMode] = useState<ClarifyResponse | null>(null)
  const [recentItem, setRecentItem] = useState<LearnItem | null>(null)
  
  // Auth state
  const [email, setEmail] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authSent, setAuthSent] = useState(false)
  const [authError, setAuthError] = useState('')

  const supabase = createClient()

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setUser(null)
        setLoading(false)
        return
      }

      setUser(user)

      // Check for user prefs
      const { data: prefs } = await supabase
        .from('user_prefs')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!prefs) {
        router.push('/onboarding')
        return
      }

      setPrefs(prefs)
      
      // Apply saved theme preference
      if (prefs.theme) {
        setTheme(prefs.theme === 'auto' ? 'system' : prefs.theme)
      }
      
      // Load topic options
      loadTopicOptions(prefs.preferred_topics, prefs.depth)
      
      // Load recent item
      loadRecentItem()
    } catch (error) {
      console.error('Error checking user:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadTopicOptions(preferred_topics: string[], depth: 'concise' | 'deeper') {
    setLoadingTopics(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'topic_options',
          preferred_topics,
          depth,
        }),
      })
      const data = await res.json()
      if (data.options) {
        setTopicOptions(data.options)
      }
    } catch (error) {
      console.error('Error loading topics:', error)
    } finally {
      setLoadingTopics(false)
    }
  }

  async function loadRecentItem() {
    try {
      const res = await fetch('/api/learn?limit=1')
      const data = await res.json()
      if (data.items && data.items.length > 0) {
        setRecentItem(data.items[0])
      }
    } catch (error) {
      console.error('Error loading recent item:', error)
    }
  }

  async function handleLogin() {
    if (!email) return
    setAuthLoading(true)
    setAuthError('')
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      
      const data = await res.json()
      
      if (data.error) {
        setAuthError(data.error)
      } else {
        setAuthSent(true)
      }
    } catch (error) {
      setAuthError('Something went wrong. Please try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    setPrefs(null)
    setTopicOptions([])
    setRecentItem(null)
  }

  async function handleThemeChange(theme: 'light' | 'dark' | 'auto') {
    // Save to database
    try {
      await fetch('/api/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferred_topics: prefs?.preferred_topics || [],
          depth: prefs?.depth || 'concise',
          theme,
        }),
      })
    } catch (error) {
      console.error('Error saving theme:', error)
    }
  }

  async function handleTopicSelect(topic: string) {
    if (!prefs) return
    
    try {
      // Generate learn item
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
        console.error('Error generating content:', content.error)
        return
      }

      // Save to database
      const saveRes = await fetch('/api/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          source_type: 'topic_choice',
          content,
        }),
      })
      const saveData = await saveRes.json()
      
      if (saveData.item) {
        router.push(`/learn/${saveData.item.id}`)
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  async function handleTeachMe() {
    if (!teachInput.trim() || !prefs) return
    
    // Check if input is too vague (single word or very short)
    const words = teachInput.trim().split(/\s+/)
    if (words.length <= 2) {
      setLoadingTeach(true)
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'clarify_topic',
            preferred_topics: prefs.preferred_topics,
            depth: prefs.depth,
            custom_topic: teachInput,
          }),
        })
        const data = await res.json()
        if (data.question && data.options) {
          setClarifyMode(data)
        }
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoadingTeach(false)
      }
      return
    }

    // Direct generation for specific topics
    setLoadingTeach(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'learn_item',
          preferred_topics: prefs.preferred_topics,
          depth: prefs.depth,
          custom_topic: teachInput,
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
          topic: teachInput,
          source_type: 'teach_me',
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
      setLoadingTeach(false)
    }
  }

  async function handleClarifySelect(angle: string) {
    if (!prefs) return
    setLoadingTeach(true)
    setClarifyMode(null)
    
    const fullTopic = `${teachInput}: ${angle}`
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'learn_item',
          preferred_topics: prefs.preferred_topics,
          depth: prefs.depth,
          custom_topic: fullTopic,
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
          topic: fullTopic,
          source_type: 'teach_me',
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
      setLoadingTeach(false)
      setTeachInput('')
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Loading..." />
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <BookOpen className="h-10 w-10 text-primary" />
              <h1 className="text-4xl font-bold">Educel</h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Your personal knowledge feed for busy professionals
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>
                Enter your email to receive a magic link
              </CardDescription>
            </CardHeader>
            <CardContent>
              {authSent ? (
                <div className="text-center py-4">
                  <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Check your email</h3>
                  <p className="text-sm text-muted-foreground">
                    We sent a magic link to {email}
                  </p>
                  <Button 
                    variant="ghost" 
                    className="mt-4"
                    onClick={() => setAuthSent(false)}
                  >
                    Use a different email
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                  {authError && (
                    <p className="text-sm text-destructive">{authError}</p>
                  )}
                  <Button 
                    className="w-full" 
                    onClick={handleLogin}
                    disabled={authLoading || !email}
                  >
                    {authLoading ? (
                      <LoadingSpinner className="h-4 w-4" />
                    ) : (
                      <>Continue with Email<ArrowRight className="ml-2 h-4 w-4" /></>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>Short, AI-generated learning cards</p>
            <p>30-120 seconds each • Always a next action</p>
          </div>
        </div>
      </div>
    )
  }

  // Logged in - main app
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">Educel</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeDropdown onThemeChange={handleThemeChange} />
            <Button variant="ghost" size="icon" onClick={() => router.push('/saved')}>
              <Bookmark className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-3xl mx-auto space-y-10">
        {/* Pick a lane section with rotating headline */}
        <section>
          <RotatingHeadline />
          <p className="text-muted-foreground mb-6">Choose a topic to start learning</p>
          
          <div className="grid gap-4">
            {loadingTopics ? (
              <>
                <TopicCardSkeleton />
                <TopicCardSkeleton />
                <TopicCardSkeleton />
              </>
            ) : (
              topicOptions.map((option, i) => (
                <Card 
                  key={i} 
                  className="cursor-pointer hover:border-primary/50 transition-colors group"
                  onClick={() => handleTopicSelect(option.topic)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                        <TopicIcon topic={option.topic} className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-lg group-hover:text-primary transition-colors">
                          {option.topic}
                        </h3>
                        <p className="text-muted-foreground text-sm mt-1">
                          {option.hook}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {!loadingTopics && topicOptions.length > 0 && (
            <Button 
              variant="ghost" 
              className="mt-4" 
              onClick={() => prefs && loadTopicOptions(prefs.preferred_topics, prefs.depth)}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Refresh suggestions
            </Button>
          )}
        </section>

        {/* Teach me section */}
        <section>
          <h2 className="text-2xl font-semibold mb-1">Teach me about...</h2>
          <p className="text-muted-foreground mb-4">Ask anything specific you want to learn</p>
          
          {clarifyMode ? (
            <Card>
              <CardContent className="p-6">
                <h3 className="font-medium mb-4">{clarifyMode.question}</h3>
                <div className="space-y-2">
                  {clarifyMode.options.map((option, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3 px-4"
                      onClick={() => handleClarifySelect(option)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
                <Button 
                  variant="ghost" 
                  className="mt-4 w-full"
                  onClick={() => setClarifyMode(null)}
                >
                  Cancel
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="Be specific, e.g. 'how to negotiate a deadline with a client'"
                value={teachInput}
                onChange={(e) => setTeachInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTeachMe()}
                disabled={loadingTeach}
                className="flex-1"
              />
              <Button 
                onClick={handleTeachMe} 
                disabled={loadingTeach || !teachInput.trim()}
              >
                {loadingTeach ? (
                  <LoadingSpinner className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </section>

        {/* Continue section - Updated with ellipsis icon and date */}
        {recentItem && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Continue where you left off</h2>
            <Card 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => router.push(`/learn/${recentItem.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium">{recentItem.content.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{recentItem.topic}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Last opened {formatDate(recentItem.created_at)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </div>
  )
}
