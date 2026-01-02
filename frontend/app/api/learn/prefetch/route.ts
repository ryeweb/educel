import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { normalizeTopic } from '@/lib/discovery'
import { calculateExpiresAt } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

const PrefetchSchema = z.object({
  topic: z.string().min(1).max(500),
  preferred_topics: z.array(z.string()).min(3).max(20),
  depth: z.enum(['concise', 'deeper']),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate request body
  let validatedData
  try {
    const body = await req.json()
    validatedData = PrefetchSchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { topic, preferred_topics, depth } = validatedData
  const normalizedTopic = normalizeTopic(topic)

  // 1. Check if learn_item already exists for this user + normalized topic
  // Use the UNIQUE constraint (user_id, topic) for lookup
  const { data: existing, error: lookupError } = await supabase
    .from('learn_items')
    .select('*')
    .eq('user_id', user.id)
    .eq('topic', normalizedTopic)
    .single()

  // If exists and not expired, return it
  if (existing && !lookupError) {
    const now = new Date()
    const expiresAt = existing.expires_at ? new Date(existing.expires_at) : null

    if (!expiresAt || expiresAt > now) {
      return NextResponse.json({ item: existing, cached: true })
    }
  }

  // 2. Generate new content from Claude
  let generateRes
  try {
    // Use proper URL construction for Vercel serverless
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
    generateRes = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward auth cookies
        'Cookie': req.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        type: 'learn_item',
        preferred_topics,
        depth,
        topic,
      }),
    })
  } catch (fetchError) {
    console.error('Prefetch fetch error:', fetchError)
    return NextResponse.json({
      error: 'Failed to generate content. Please try again.',
      details: fetchError instanceof Error ? fetchError.message : 'Unknown error'
    }, { status: 500 })
  }

  if (!generateRes.ok) {
    let errorMessage = 'Generation failed'
    try {
      const error = await generateRes.json()
      errorMessage = error.error || errorMessage

      // Pass through rate limit errors
      if (generateRes.status === 429) {
        return NextResponse.json({
          error: 'Rate limit reached. Please wait a moment and try again.',
          rateLimited: true
        }, { status: 429 })
      }
    } catch (e) {
      console.error('Error parsing generate error response:', e)
    }

    return NextResponse.json({
      error: errorMessage,
      status: generateRes.status
    }, { status: generateRes.status || 500 })
  }

  const content = await generateRes.json()

  // Remove _meta if present
  const { _meta, ...cleanContent } = content

  // 3. Upsert learn_item with proper conflict handling
  const expires_at = calculateExpiresAt()

  // Use proper upsert with the existing ID if found, or generate new
  const itemId = existing?.id || uuidv4()

  const { data: item, error: upsertError } = await supabase
    .from('learn_items')
    .upsert({
      id: itemId,
      user_id: user.id,
      topic: normalizedTopic,
      source_type: 'topic_choice',
      content: cleanContent,
      expires_at,
    }, {
      onConflict: 'user_id,topic',
      ignoreDuplicates: false,
    })
    .select()
    .single()

  if (upsertError) {
    console.error('Error upserting learn_item:', upsertError)
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ item, cached: false })
}
