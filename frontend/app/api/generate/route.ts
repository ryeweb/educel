import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { GenerateRequest, LearnContent, TopicOption, ClarifyResponse, ExpandedContent, LessonPlanContent, getFallbackSources } from '@/lib/types'
import { claudeRateLimiter, checkRateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { withTimeout, TIMEOUTS, TimeoutError } from '@/lib/timeout'

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
})

// Best-effort validation - accepts responses without sources
function isValidLearnContent(obj: unknown): obj is LearnContent {
  if (typeof obj !== 'object' || obj === null) return false
  const content = obj as Record<string, unknown>
  
  // Core fields are required
  const hasCore = (
    typeof content.title === 'string' &&
    typeof content.hook === 'string' &&
    Array.isArray(content.bullets) &&
    content.bullets.length === 3 &&
    content.bullets.every((b: unknown) => typeof b === 'string') &&
    typeof content.example === 'string' &&
    typeof content.micro_action === 'string' &&
    typeof content.quiz_question === 'string' &&
    typeof content.quiz_answer === 'string'
  )
  
  // Sources are optional - don't fail validation if missing
  if (content.sources !== undefined) {
    if (!Array.isArray(content.sources)) return hasCore
    // Validate source structure if present
    const validSources = content.sources.every((s: unknown) => {
      if (typeof s !== 'object' || s === null) return false
      const source = s as Record<string, unknown>
      return typeof source.title === 'string' && typeof source.url === 'string'
    })
    if (!validSources) {
      // Clear invalid sources, keep the rest
      content.sources = []
    }
  }
  
  return hasCore
}

function isValidTopicOptions(obj: unknown): obj is { options: TopicOption[] } {
  if (typeof obj !== 'object' || obj === null) return false
  const data = obj as Record<string, unknown>
  if (!Array.isArray(data.options) || data.options.length !== 3) return false
  return data.options.every((opt: unknown) => {
    if (typeof opt !== 'object' || opt === null) return false
    const option = opt as Record<string, unknown>
    return typeof option.topic === 'string' && typeof option.hook === 'string'
  })
}

function isValidClarifyResponse(obj: unknown): obj is ClarifyResponse {
  if (typeof obj !== 'object' || obj === null) return false
  const data = obj as Record<string, unknown>
  return (
    typeof data.question === 'string' &&
    Array.isArray(data.options) &&
    data.options.length === 3 &&
    data.options.every((o: unknown) => typeof o === 'string')
  )
}

function isValidExpandedContent(obj: unknown): obj is ExpandedContent {
  if (typeof obj !== 'object' || obj === null) return false
  const data = obj as Record<string, unknown>
  return (
    Array.isArray(data.paragraphs) &&
    data.paragraphs.length >= 3 &&
    data.paragraphs.length <= 6 &&
    data.paragraphs.every((p: unknown) => typeof p === 'string')
  )
}

function isValidLessonPlan(obj: unknown): obj is LessonPlanContent {
  if (typeof obj !== 'object' || obj === null) return false
  const data = obj as Record<string, unknown>
  return (
    Array.isArray(data.goals) &&
    data.goals.length >= 2 &&
    Array.isArray(data.resources) &&
    data.resources.length >= 3 &&
    Array.isArray(data.exercises) &&
    data.exercises.length >= 2 &&
    Array.isArray(data.daily_plan) &&
    data.daily_plan.length >= 7
  )
}

function getSystemPrompt(depth: 'concise' | 'deeper'): string {
  const depthInstruction = depth === 'concise' 
    ? 'Keep content crisp and scannable. Prioritize actionable insights over depth.'
    : 'Provide slightly more context and nuance while remaining practical.'

  return `You are Educel, an AI knowledge assistant for busy professionals and founders.

Tone Guidelines:
- Calm, smart, slightly analytical
- Practical and insightful, never motivational or cheesy
- Use professional/founder-relevant examples
- Avoid medical or legal advice; if requested, provide general info and suggest verification

Content Rules:
- ${depthInstruction}
- Make every word count
- Focus on actionable, memorable insights
- Use concrete examples from business, technology, or professional contexts

You MUST respond with valid JSON only. No markdown, no explanation, just the JSON object.`
}

function getPromptForType(request: GenerateRequest): string {
  const { type, preferred_topics, topic, custom_topic, prior_item } = request
  
  switch (type) {
    case 'topic_options':
      return `Generate 3 learning topic suggestions based on these preferred areas: ${preferred_topics.join(', ')}

Respond with ONLY this JSON structure:
{
  "options": [
    {"topic": "Specific topic title", "hook": "One intriguing line about why this matters"},
    {"topic": "Specific topic title", "hook": "One intriguing line about why this matters"},
    {"topic": "Specific topic title", "hook": "One intriguing line about why this matters"}
  ]
}

Make topics specific and immediately actionable (not broad categories). Hooks should create curiosity.`

    case 'adjacent_options':
      return `Based on the topic "${topic}", suggest 3 related but distinct topics the user might want to explore next.

Respond with ONLY this JSON structure:
{
  "options": [
    {"topic": "Adjacent topic title", "hook": "Why this connects and why it matters"},
    {"topic": "Adjacent topic title", "hook": "Why this connects and why it matters"},
    {"topic": "Adjacent topic title", "hook": "Why this connects and why it matters"}
  ]
}`

    case 'clarify_topic':
      return `The user wants to learn about: "${custom_topic}"

This is too broad or vague. Generate a clarifying question with 3 specific angle options.

Respond with ONLY this JSON structure:
{
  "question": "What angle interests you most?",
  "options": ["Specific angle 1", "Specific angle 2", "Specific angle 3"]
}

Make options distinct and practical for a professional/founder audience.`

    case 'learn_item':
    case 'learn_more':
      const contextNote = type === 'learn_more' && prior_item
        ? `\n\nThis is a follow-up to: "${prior_item.title}". Go deeper on a specific aspect or reveal an advanced insight.`
        : ''
      
      return `Create a micro-learning item about: "${topic || custom_topic}"${contextNote}

Respond with ONLY this JSON structure:
{
  "title": "Clear, specific title (max 10 words)",
  "hook": "One sentence that makes this feel essential to know",
  "bullets": [
    "Key insight 1 (max 16 words)",
    "Key insight 2 (max 16 words)",
    "Key insight 3 (max 16 words)"
  ],
  "example": "A concrete 2-4 sentence example, preferably from business/professional context",
  "micro_action": "One specific thing to try today (max 140 characters)",
  "quiz_question": "A thoughtful question to test understanding",
  "quiz_answer": "Brief, clear answer",
  "sources": [
    {"title": "Source name", "url": "https://credible-domain.com/path"}
  ]
}

For sources: Try to include 1-2 relevant links from credible publications (HBR, MIT Sloan, reputable sites). If unsure, you may omit the sources array.

Ensure bullets are exactly 3 items. Make the micro_action immediately actionable.`

    case 'expand_content':
      return `Expand on this learning topic: "${topic}"

Previous summary: "${prior_item?.title}: ${prior_item?.hook}"
Key points covered: ${prior_item?.bullets?.join('; ')}

Create a deeper exploration that adds significant value beyond the summary.

Respond with ONLY this JSON structure:
{
  "paragraphs": [
    "First paragraph - deeper context or background (3-4 sentences)",
    "Second paragraph - key concept explained in more detail (3-4 sentences)", 
    "Third paragraph - practical implications or nuances (3-4 sentences)",
    "Fourth paragraph - advanced insight or counterintuitive take (3-4 sentences)",
    "Fifth paragraph - how experts think about this differently (3-4 sentences)"
  ],
  "additional_bullets": [
    "Advanced insight 1",
    "Advanced insight 2",
    "Advanced insight 3"
  ]
}

Write 4-6 paragraphs. Each paragraph should be substantive (3-4 sentences). Don't repeat what was in the summary.`

    case 'lesson_plan':
      return `Create a comprehensive lesson plan for learning: "${topic}"

Context from initial learning: "${prior_item?.title}"

Respond with ONLY this JSON structure:
{
  "goals": [
    "Learning goal 1 - specific, measurable outcome",
    "Learning goal 2 - specific, measurable outcome",
    "Learning goal 3 - specific, measurable outcome"
  ],
  "resources": [
    {"title": "Resource name", "url": "https://credible-site.com/path", "type": "article"},
    {"title": "Book recommendation", "url": "https://amazon.com/book", "type": "book"},
    {"title": "Video or talk", "url": "https://youtube.com/watch", "type": "video"},
    {"title": "Online course", "url": "https://coursera.org/course", "type": "course"},
    {"title": "Useful tool", "url": "https://tool-site.com", "type": "tool"}
  ],
  "exercises": [
    "Practical exercise 1 - hands-on activity",
    "Practical exercise 2 - reflection or analysis task",
    "Practical exercise 3 - real-world application"
  ],
  "daily_plan": [
    {"day": 1, "focus": "Foundation", "activities": ["Read intro material", "Take notes"]},
    {"day": 2, "focus": "Deep dive", "activities": ["Study resource 1", "Complete exercise 1"]},
    {"day": 3, "focus": "Practice", "activities": ["Watch video content", "Practice application"]},
    {"day": 4, "focus": "Connect", "activities": ["Review and connect ideas", "Exercise 2"]},
    {"day": 5, "focus": "Apply", "activities": ["Apply to current project", "Document learnings"]},
    {"day": 6, "focus": "Advanced", "activities": ["Explore edge cases", "Exercise 3"]},
    {"day": 7, "focus": "Review", "activities": ["Quiz yourself", "Plan next steps"]}
  ]
}

Include 5-7 resources of mixed types. Create a 7-14 day plan that builds progressively.`

    default:
      throw new Error(`Unknown generation type: ${type}`)
  }
}

// Retry wrapper with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Don't retry on validation errors or client errors (4xx)
      if (error instanceof Error && error.message.includes('does not match expected schema')) {
        throw error
      }

      // Only retry on the last attempt
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = baseDelayMs * Math.pow(2, attempt)
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms delay`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  throw lastError || new Error('Max retries exceeded')
}

// Claude API call with retry logic
async function generateContent(
  systemPrompt: string,
  userPrompt: string,
  validateFn: (obj: unknown) => boolean,
  topic?: string
): Promise<{ result: unknown; usedFallbackSources: boolean }> {
  const result = await withRetry(async () => {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    })

    return message
  })

  const message = result

  const textContent = message.content.find(block => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in response')
  }

  // Clean up potential markdown code blocks
  let jsonStr = textContent.text.trim()
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7)
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3)
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3)
  }
  jsonStr = jsonStr.trim()

  const parsed = JSON.parse(jsonStr)
  
  if (!validateFn(parsed)) {
    throw new Error('Response does not match expected schema')
  }

  // Check if we need fallback sources for learn_item
  let usedFallbackSources = false
  if (parsed && typeof parsed === 'object' && 'title' in parsed) {
    const content = parsed as LearnContent
    if (!content.sources || content.sources.length === 0) {
      // Use fallback sources based on topic
      if (topic) {
        content.sources = getFallbackSources(topic)
        usedFallbackSources = true
      }
    }
  }

  return { result: parsed, usedFallbackSources }
}

export async function POST(req: NextRequest) {
  try {
    // Validate Claude API key is configured
    if (!process.env.CLAUDE_API_KEY) {
      console.error('CLAUDE_API_KEY environment variable is not set')
      return NextResponse.json(
        { error: 'AI service is not configured. Please contact support.' },
        { status: 503 }
      )
    }

    // Get user for rate limiting
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Apply rate limiting (20 requests per hour per user)
    const rateLimitResult = await checkRateLimit(claudeRateLimiter, user.id)

    if (!rateLimitResult.success) {
      const resetDate = new Date(rateLimitResult.resetAt)
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please try again later.',
          resetAt: resetDate.toISOString(),
          limit: rateLimitResult.limit
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetDate.toISOString(),
          }
        }
      )
    }

    const body: GenerateRequest = await req.json()
    const { type, depth, topic, custom_topic } = body

    if (!type || !depth) {
      return NextResponse.json(
        { error: 'Missing required fields: type and depth' },
        { status: 400 }
      )
    }

    const systemPrompt = getSystemPrompt(depth)
    const userPrompt = getPromptForType(body)

    let validateFn: (obj: unknown) => boolean
    
    switch (type) {
      case 'topic_options':
      case 'adjacent_options':
        validateFn = isValidTopicOptions
        break
      case 'clarify_topic':
        validateFn = isValidClarifyResponse
        break
      case 'learn_item':
      case 'learn_more':
        validateFn = isValidLearnContent
        break
      case 'expand_content':
        validateFn = isValidExpandedContent
        break
      case 'lesson_plan':
        validateFn = isValidLessonPlan
        break
      default:
        return NextResponse.json(
          { error: `Invalid generation type: ${type}` },
          { status: 400 }
        )
    }

    // Wrap generation with timeout (30 seconds)
    const { result, usedFallbackSources } = await withTimeout(
      generateContent(
        systemPrompt,
        userPrompt,
        validateFn,
        topic || custom_topic
      ),
      TIMEOUTS.CLAUDE_API,
      'AI generation timed out. Please try again.'
    )

    return NextResponse.json({
      ...result as object,
      _meta: { usedFallbackSources }
    })
  } catch (error) {
    console.error('Generate API error:', error)

    // Handle timeout errors specifically
    if (error instanceof TimeoutError) {
      return NextResponse.json(
        { error: error.message },
        { status: 504 } // Gateway Timeout
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
