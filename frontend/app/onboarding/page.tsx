'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { LoadingSpinner } from '@/components/loading'
import { CURATED_TOPICS } from '@/lib/types'
import { BookOpen, Plus, X, ArrowRight } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [customTopics, setCustomTopics] = useState<string[]>([])
  const [newCustomTopic, setNewCustomTopic] = useState('')
  const [depth, setDepth] = useState<'concise' | 'deeper'>('concise')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  function toggleTopic(topic: string) {
    setSelectedTopics(prev => 
      prev.includes(topic)
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    )
  }

  function addCustomTopic() {
    const topic = newCustomTopic.trim()
    if (topic && !customTopics.includes(topic) && !CURATED_TOPICS.includes(topic as any)) {
      setCustomTopics(prev => [...prev, topic])
      setNewCustomTopic('')
    }
  }

  function removeCustomTopic(topic: string) {
    setCustomTopics(prev => prev.filter(t => t !== topic))
  }

  async function handleSave() {
    const allTopics = [...selectedTopics, ...customTopics]
    
    if (allTopics.length < 2) {
      setError('Please select at least 2 topics')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferred_topics: allTopics,
          depth,
        }),
      })

      const data = await res.json()

      if (data.error) {
        setError(data.error)
        return
      }

      router.push('/')
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const totalSelected = selectedTopics.length + customTopics.length

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Welcome to Educel</h1>
          </div>
          <p className="text-muted-foreground">
            Let&apos;s personalize your learning experience
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>What do you want to learn?</CardTitle>
            <CardDescription>
              Select topics that interest you (at least 2)
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
              <Label className="text-sm font-medium">Add your own topics</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="e.g., Machine Learning, Public Speaking"
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
            <CardTitle>How deep do you want to go?</CardTitle>
            <CardDescription>
              Choose your default learning depth
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={depth} onValueChange={(v) => setDepth(v as 'concise' | 'deeper')}>
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

        {error && (
          <p className="text-destructive text-sm text-center mb-4">{error}</p>
        )}

        <Button 
          className="w-full" 
          size="lg" 
          onClick={handleSave}
          disabled={saving || totalSelected < 2}
        >
          {saving ? (
            <LoadingSpinner className="h-4 w-4" />
          ) : (
            <>
              Start Learning
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground mt-4">
          {totalSelected} topic{totalSelected !== 1 ? 's' : ''} selected
        </p>
      </div>
    </div>
  )
}
