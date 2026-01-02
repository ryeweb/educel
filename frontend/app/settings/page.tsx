'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { LoadingSpinner } from '@/components/loading'
import { NavMenu } from '@/components/nav-menu'
import { CURATED_TOPICS } from '@/lib/types'
import type { UserPrefs } from '@/lib/types'
import { ArrowLeft, Settings, Plus, X, Save, Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'

export default function SettingsPage() {
  const router = useRouter()
  const { setTheme: setUITheme } = useTheme()
  const [prefs, setPrefs] = useState<UserPrefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined)

  // Form state
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [customTopics, setCustomTopics] = useState<string[]>([])
  const [newCustomTopic, setNewCustomTopic] = useState('')
  const [depth, setDepth] = useState<'concise' | 'deeper'>('concise')
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto')

  const supabase = createClient()

  useEffect(() => {
    loadPrefs()
    loadUser()
  }, [])

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserEmail(user?.email)
  }

  async function loadPrefs() {
    try {
      const res = await fetch('/api/prefs')
      const data = await res.json()
      
      if (data.prefs) {
        setPrefs(data.prefs)
        
        // Separate curated and custom topics
        const curated: string[] = []
        const custom: string[] = []
        
        data.prefs.preferred_topics.forEach((topic: string) => {
          if (CURATED_TOPICS.includes(topic as any)) {
            curated.push(topic)
          } else {
            custom.push(topic)
          }
        })
        
        setSelectedTopics(curated)
        setCustomTopics(custom)
        setDepth(data.prefs.depth)
        setTheme(data.prefs.theme || 'auto')
      }
    } catch (error) {
      console.error('Error loading prefs:', error)
    } finally {
      setLoading(false)
    }
  }

  function toggleTopic(topic: string) {
    setSelectedTopics(prev => 
      prev.includes(topic)
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    )
    setSuccess(false)
  }

  function addCustomTopic() {
    const topic = newCustomTopic.trim()
    if (topic && !customTopics.includes(topic) && !CURATED_TOPICS.includes(topic as any)) {
      setCustomTopics(prev => [...prev, topic])
      setNewCustomTopic('')
      setSuccess(false)
    }
  }

  function removeCustomTopic(topic: string) {
    setCustomTopics(prev => prev.filter(t => t !== topic))
    setSuccess(false)
  }

  async function handleSave() {
    if (selectedTopics.length < 3) {
      setError('Please select at least 3 curated topics')
      return
    }

    const allTopics = [...selectedTopics, ...customTopics]

    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const res = await fetch('/api/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferred_topics: allTopics,
          depth,
          theme,
        }),
      })

      const data = await res.json()

      if (data.error) {
        setError(data.error)
        return
      }

      setSuccess(true)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Loading settings..." />
      </div>
    )
  }

  const totalSelected = selectedTopics.length + customTopics.length

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
            <Settings className="h-5 w-5 text-primary" />
            <span className="font-medium">Settings</span>
          </div>
          <NavMenu userEmail={userEmail} />
        </div>
      </header>

      <main className="container py-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Preferences</h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Learning Topics</CardTitle>
            <CardDescription>
              Select topics you want to learn about (at least 3)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              {CURATED_TOPICS.map(topic => (
                <div
                  key={topic}
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTopics.includes(topic)
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => toggleTopic(topic)}
                >
                  <Checkbox 
                    checked={selectedTopics.includes(topic)}
                    onCheckedChange={() => toggleTopic(topic)}
                  />
                  <Label className="cursor-pointer text-sm">{topic}</Label>
                </div>
              ))}
            </div>

            {/* Custom topics */}
            <div className="border-t pt-4">
              <Label className="text-sm font-medium">Custom topics</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Add a custom topic"
                  value={newCustomTopic}
                  onChange={(e) => setNewCustomTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomTopic()}
                />
                <Button variant="outline" size="icon" onClick={addCustomTopic}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {customTopics.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {customTopics.map(topic => (
                    <div
                      key={topic}
                      className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-sm"
                    >
                      {topic}
                      <button onClick={() => removeCustomTopic(topic)}>
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Learning Depth</CardTitle>
            <CardDescription>
              Choose your preferred level of detail
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={depth}
              onValueChange={(v) => {
                setDepth(v as 'concise' | 'deeper')
                setSuccess(false)
              }}
            >
              <div className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:border-primary/50">
                <RadioGroupItem value="concise" id="concise" className="mt-1" />
                <div>
                  <Label htmlFor="concise" className="cursor-pointer font-medium">Concise</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Quick, scannable insights. Perfect for busy schedules.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:border-primary/50 mt-2">
                <RadioGroupItem value="deeper" id="deeper" className="mt-1" />
                <div>
                  <Label htmlFor="deeper" className="cursor-pointer font-medium">Deeper</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    More context and nuance. For when you want to go further.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Display Theme</CardTitle>
            <CardDescription>
              Choose how Educel looks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={theme}
              onValueChange={(v) => {
                const newTheme = v as 'light' | 'dark' | 'auto'
                setTheme(newTheme)
                // Apply theme immediately to UI
                setUITheme(newTheme === 'auto' ? 'system' : newTheme)
                setSuccess(false)
              }}
            >
              <div className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:border-primary/50">
                <RadioGroupItem value="light" id="light" className="mt-1" />
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="light" className="cursor-pointer font-medium">Light</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Light mode for daytime reading
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:border-primary/50 mt-2">
                <RadioGroupItem value="dark" id="dark" className="mt-1" />
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="dark" className="cursor-pointer font-medium">Dark</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Dark mode for low-light environments
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:border-primary/50 mt-2">
                <RadioGroupItem value="auto" id="auto" className="mt-1" />
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="auto" className="cursor-pointer font-medium">Auto</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Matches your system preferences
                    </p>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {error && (
          <p className="text-destructive text-sm text-center mb-4">{error}</p>
        )}
        
        {success && (
          <p className="text-green-600 text-sm text-center mb-4">Settings saved successfully!</p>
        )}

        <Button
          className="w-full"
          size="lg"
          onClick={handleSave}
          disabled={saving || selectedTopics.length < 3}
        >
          {saving ? (
            <LoadingSpinner className="h-4 w-4" />
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground mt-4">
          {selectedTopics.length} curated topic{selectedTopics.length !== 1 ? 's' : ''} selected
          {customTopics.length > 0 && ` + ${customTopics.length} custom`}
        </p>
      </main>
    </div>
  )
}
