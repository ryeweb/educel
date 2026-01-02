import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const EventSchema = z.object({
  event_type: z.enum([
    'reco_shown',
    'topic_clicked',
    'content_viewed',
    'saved',
    'quiz_completed',
    'plan_generated',
  ]),
  topic: z.string().optional(),
  learn_item_id: z.string().uuid().optional(),
  slot: z.enum(['A', 'B', 'C']).optional(),
  meta: z.record(z.any()).optional(),
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
    validatedData = EventSchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { event_type, topic, learn_item_id, slot, meta } = validatedData

  // For content_viewed events, check if already logged this session
  if (event_type === 'content_viewed' && learn_item_id && meta?.session_id) {
    const { data: existing } = await supabase
      .from('user_events')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_type', 'content_viewed')
      .eq('learn_item_id', learn_item_id)
      .eq('meta->>session_id', meta.session_id)
      .single()

    if (existing) {
      // Already logged this view in this session
      return NextResponse.json({ success: true, deduplicated: true })
    }
  }

  // Insert event
  const { error } = await supabase
    .from('user_events')
    .insert({
      user_id: user.id,
      event_type,
      topic,
      learn_item_id,
      slot,
      meta: meta || {},
    })

  if (error) {
    console.error('Error logging event:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
