import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { GenerateRequest, LearnContent, TopicOption, ClarifyResponse } from '@/lib/types'

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
})

function isValidLearnContent(obj: unknown): obj is LearnContent {
  if (typeof obj !== 'object' || obj === null) return false
  const content = obj as Record<string, unknown>
  return (
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

function getSystemPrompt(depth: 'concise' | 'deeper'): string {
  const depthInstruction = depth === 'concise' 
    ? 'Keep content crisp and scannable. Prioritize actionable insights over depth.'
    : 'Provide slightly more context and nuance while remaining practical.'

  return `You are Educel, an AI knowledge assistant for busy professionals and founders.

Tone Guidelines:
- Calm, smart, slightly analytical
- Practical and insightful, never motivational or cheesy
- Use professional/founder-relevant examples
- No citations unless explicitly asked
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
  "quiz_answer": "Brief, clear answer"
}

Ensure bullets are exactly 3 items. Make the micro_action immediately actionable.`

    default:
      throw new Error(`Unknown generation type: ${type}`)
  }
}

async function generateWithRetry(
  systemPrompt: string,
  userPrompt: string,
  validateFn: (obj: unknown) => boolean,
  maxRetries = 1
): Promise<unknown> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: attempt === 0 
              ? userPrompt 
              : `${userPrompt}\n\nIMPORTANT: Your previous response was not valid JSON. Please respond with ONLY the JSON object, no markdown formatting or additional text.`
          }
        ],
        system: systemPrompt,
      })

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
      
      if (validateFn(parsed)) {
        return parsed
      }
      
      throw new Error('Response does not match expected schema')
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`Attempt ${attempt + 1} failed:`, lastError.message)
    }
  }

  throw lastError || new Error('Generation failed')
}

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json()
    const { type, depth } = body

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
      default:
        return NextResponse.json(
          { error: `Invalid generation type: ${type}` },
          { status: 400 }
        )
    }

    const result = await generateWithRetry(systemPrompt, userPrompt, validateFn)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Generate API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
