import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { GenerateRequest, LearnContent, TopicOption, ClarifyResponse, ExpandedContent, LessonPlanContent, getFallbackSources } from '@/lib/types'
import { claudeRateLimiter, checkRateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { withTimeout, TIMEOUTS, TimeoutError } from '@/lib/timeout'
import { normalizeTopic, generateSessionId } from '@/lib/discovery'

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
    data.paragraphs.every((p: unknown) => typeof p === 'string') &&
    typeof data.one_line_takeaway === 'string' &&
    data.one_line_takeaway.length > 0
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

// Personalization helpers
async function getTopicEngagement(supabase: any, userId: string): Promise<Map<string, number>> {
  // Get events from last 14 days
  const { data: events } = await supabase
    .from('user_events')
    .select('event_type, topic')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
    .not('topic', 'is', null)

  if (!events || events.length === 0) {
    return new Map()
  }

  // Simple scoring: saved > quiz > plan > clicked > viewed
  const weights: Record<string, number> = {
    'saved': 4,
    'quiz_completed': 3,
    'plan_generated': 6,
    'topic_clicked': 2,
    'content_viewed': 1,
  }

  const scores = new Map<string, number>()

  for (const event of events) {
    const topic = normalizeTopic(event.topic)
    const weight = weights[event.event_type] || 1
    scores.set(topic, (scores.get(topic) || 0) + weight)
  }

  return scores
}

async function getRecentTopics(supabase: any, userId: string): Promise<Set<string>> {
  // Get last 30 shown topics for repeat avoidance
  const { data: recos } = await supabase
    .from('home_recos')
    .select('topic')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)

  const topics = new Set<string>()
  if (recos) {
    for (const reco of recos) {
      topics.add(normalizeTopic(reco.topic))
    }
  }
  return topics
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

function getPromptForType(request: GenerateRequest & { avoid_topics?: string[]; top_engaged_topic?: string }): string {
  const { type, preferred_topics, topic, custom_topic, prior_item, avoid_topics, top_engaged_topic } = request

  switch (type) {
    case 'topic_options':
      const avoidNote = avoid_topics && avoid_topics.length > 0
        ? `\n\nIMPORTANT - Do NOT suggest these recently shown topics: ${avoid_topics.join(', ')}`
        : ''
      const engagementHint = top_engaged_topic
        ? `\n\nPersonalization hint: The user recently engaged with "${top_engaged_topic}". Consider this when choosing topics, but ensure variety.`
        : ''

      return `Generate 3 learning topic suggestions based on these preferred areas: ${preferred_topics.join(', ')}${engagementHint}${avoidNote}

Respond with ONLY this JSON structure:
{
  "options": [
    {"topic": "Specific Topic Title In Title Case", "hook": "One intriguing line about why this matters"},
    {"topic": "Specific Topic Title In Title Case", "hook": "One intriguing line about why this matters"},
    {"topic": "Specific Topic Title In Title Case", "hook": "One intriguing line about why this matters"}
  ]
}

IMPORTANT: Use proper Title Case for all topics (capitalize first letter of main words). Make topics specific and immediately actionable (not broad categories). Hooks should create curiosity. All 3 topics MUST be distinct from each other and from the avoid list.`

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

CRITICAL - Sources rules:
- ONLY include sources from well-known, established websites that you're confident exist
- Good domains: hbr.org, sloanreview.mit.edu, hbs.edu, mckinsey.com, bcg.com, ted.com, youtube.com, wikipedia.org
- Do NOT guess or fabricate URLs - it's better to omit the sources array entirely than to include uncertain links
- If you include sources, use ONLY root domains or extremely common paths (e.g., https://hbr.org not https://hbr.org/2024/specific-article)
- When uncertain, omit the sources array completely - fallback sources will be used automatically

Ensure bullets are exactly 3 items. Make the micro_action immediately actionable.`

    case 'expand_content':
      return `Expand on this learning topic: "${topic}"

Previous summary: "${prior_item?.title}: ${prior_item?.hook}"
Key points covered: ${prior_item?.bullets?.join('; ')}

Create a deeper exploration that adds significant value beyond the summary.

Respond with ONLY this JSON structure:
{
  "paragraphs": [
    "First paragraph - deeper context or background",
    "Second paragraph - key concept explained in more detail",
    "Third paragraph - practical implications or nuances",
    "Fourth paragraph - advanced insight or counterintuitive take",
    "Fifth paragraph - how experts think about this differently"
  ],
  "additional_bullets": [
    "Advanced insight 1",
    "Advanced insight 2",
    "Advanced insight 3"
  ],
  "one_line_takeaway": "A single memorable sentence summarizing the core insight (max 100 characters)"
}

Writing guidelines for easier reading:
- Write 4-6 paragraphs, each with 2-3 sentences (shorter is better)
- Use conversational, accessible language - avoid academic or overly formal tone
- Prefer simple words over complex ones where possible
- Break complex ideas into clear, digestible chunks
- Use active voice and direct statements
- Make it feel like a knowledgeable friend explaining, not a textbook
- Don't repeat what was in the summary - add new depth and perspective
- The one_line_takeaway should capture the most important insight for future recall`

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

CRITICAL - Resources rules:
- ONLY use URLs from well-established platforms you're absolutely certain exist
- Safe domains for each type:
  * Articles: hbr.org, sloanreview.mit.edu, mckinsey.com, medium.com
  * Books: amazon.com, goodreads.com
  * Videos: youtube.com, ted.com, vimeo.com
  * Courses: coursera.org, edx.org, udemy.com, linkedin.com/learning
  * Tools: Use root domains only (e.g., notion.so, figma.com, not specific paths)
- Use ONLY root domains or extremely common paths - avoid specific article/video URLs
- For books, use generic Amazon/Goodreads homepage, not specific book pages
- Better to use fewer, reliable resources than to include uncertain links

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

    // Enhanced request with personalization data
    let enhancedRequest = { ...body }

    // For topic_options, check cache first (10 min TTL)
    if (type === 'topic_options') {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

      const { data: cachedOptions, error: cacheError } = await supabase
        .from('topic_options_cache')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', tenMinutesAgo)
        .maybeSingle()

      if (cacheError) {
        console.error('Cache lookup error:', cacheError)
      }

      // Return cached options if fresh
      if (cachedOptions?.options) {
        console.log('Returning cached topic options')
        return NextResponse.json({
          ...cachedOptions.options,
          _meta: { cached: true, session_id: cachedOptions.session_id },
        })
      }

      console.log('No valid cache found, generating new topics')

      // Otherwise, add personalization for fresh generation
      const [engagementScores, recentTopics] = await Promise.all([
        getTopicEngagement(supabase, user.id),
        getRecentTopics(supabase, user.id),
      ])

      // Find top engaged topic for hint
      let topEngagedTopic: string | undefined
      let maxScore = 0
      for (const [topic, score] of engagementScores.entries()) {
        if (score > maxScore) {
          maxScore = score
          topEngagedTopic = topic
        }
      }

      // Build avoid list
      const avoidTopics = Array.from(recentTopics)

      enhancedRequest = {
        ...body,
        avoid_topics: avoidTopics,
        top_engaged_topic: topEngagedTopic,
      }
    }

    const systemPrompt = getSystemPrompt(depth)
    const userPrompt = getPromptForType(enhancedRequest)

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

    // For topic_options, save recommendations, cache, and log event
    if (type === 'topic_options' && result && typeof result === 'object' && 'options' in result) {
      const sessionId = generateSessionId()
      const options = (result as { options: TopicOption[] }).options
      const slots = ['A', 'B', 'C'] as const

      // Save to home_recos
      const recoRows = options.map((option, idx) => ({
        user_id: user.id,
        session_id: sessionId,
        slot: slots[idx],
        topic: normalizeTopic(option.topic),
      }))

      const { error: recoError } = await supabase.from('home_recos').insert(recoRows)
      if (recoError) {
        console.error('Error saving home_recos:', recoError)
      }

      // Cache topic options for 10 minutes
      const { error: cacheError } = await supabase
        .from('topic_options_cache')
        .upsert({
          user_id: user.id,
          options: result,
          session_id: sessionId,
        }, {
          onConflict: 'user_id',
        })

      if (cacheError) {
        console.error('Error saving cache:', cacheError)
      } else {
        console.log('Successfully cached topic options for user:', user.id)
      }

      // Log reco_shown event
      const { error: eventError } = await supabase.from('user_events').insert({
        user_id: user.id,
        event_type: 'reco_shown',
        meta: {
          session_id: sessionId,
          topics: options.map(o => o.topic),
          slots: ['A', 'B', 'C'],
        },
      })
      if (eventError) {
        console.error('Error logging event:', eventError)
      }

      // Return with session_id for client tracking
      return NextResponse.json({
        ...result as object,
        _meta: { usedFallbackSources, session_id: sessionId }
      })
    }

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
