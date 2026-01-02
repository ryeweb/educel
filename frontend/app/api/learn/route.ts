import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { calculateExpiresAt } from '@/lib/types'
import { CreateLearnItemSchema, UpdateLearnItemSchema } from '@/lib/validations'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  // Cap limit at 100 to prevent excessive data transfer
  const requestedLimit = parseInt(searchParams.get('limit') || '10')
  const limit = Math.min(Math.max(requestedLimit, 1), 100)

  if (id) {
    const { data, error } = await supabase
      .from('learn_items')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ item: data })
  }

  const { data, error } = await supabase
    .from('learn_items')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate request body with Zod
  let validatedData
  try {
    const body = await req.json()
    validatedData = CreateLearnItemSchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { topic, source_type, content } = validatedData

  // Set expiration for 30 days (cleared if saved)
  const expires_at = calculateExpiresAt()

  const { data, error } = await supabase
    .from('learn_items')
    .insert({
      id: uuidv4(),
      user_id: user.id,
      topic,
      source_type,
      content,
      expires_at,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate request body with Zod
  let validatedData
  try {
    const body = await req.json()
    validatedData = UpdateLearnItemSchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { id, expanded_content } = validatedData

  const { data, error } = await supabase
    .from('learn_items')
    .update({
      expanded_content,
      expanded_created_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item: data })
}
