import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { CreateSavedItemSchema } from '@/lib/validations'
import { z } from 'zod'
import { withTimeout, TIMEOUTS, TimeoutError } from '@/lib/timeout'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const item_type = searchParams.get('item_type')

    // Wrap database operations with timeout
    const items = await withTimeout(
      (async () => {
        // Get saved items first
        let query = supabase
          .from('saved_items')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100)

        if (item_type) {
          query = query.eq('item_type', item_type)
        }

        const { data: savedItems, error } = await query

        if (error) {
          throw new Error(error.message)
        }

        // Optimized approach: Use Promise.all for parallel fetching (2 queries instead of 3)
        const learningIds = savedItems.filter(s => s.item_type === 'learning').map(s => s.item_id)
        const lessonPlanIds = savedItems.filter(s => s.item_type === 'lesson_plan').map(s => s.item_id)

        const [learnItemsResult, lessonPlansResult] = await Promise.all([
          learningIds.length > 0
            ? supabase.from('learn_items').select('*').in('id', learningIds)
            : Promise.resolve({ data: [] }),
          lessonPlanIds.length > 0
            ? supabase.from('lesson_plans').select('*').in('id', lessonPlanIds)
            : Promise.resolve({ data: [] })
        ])

        // Create lookup maps
        const learnItemsMap = new Map(learnItemsResult.data?.map(item => [item.id, item]) || [])
        const lessonPlansMap = new Map(lessonPlansResult.data?.map(plan => [plan.id, plan]) || [])

        // Combine data
        return savedItems.map(saved => ({
          ...saved,
          learn_item: saved.item_type === 'learning' ? learnItemsMap.get(saved.item_id) : undefined,
          lesson_plan: saved.item_type === 'lesson_plan' ? lessonPlansMap.get(saved.item_id) : undefined,
        }))
      })(),
      TIMEOUTS.DATABASE,
      'Database query timed out'
    )

    return NextResponse.json({ items })
  } catch (error) {
    if (error instanceof TimeoutError) {
      return NextResponse.json({ error: error.message }, { status: 504 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch saved items' },
      { status: 500 }
    )
  }
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
    validatedData = CreateSavedItemSchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { item_type, item_id, learn_item_id } = validatedData

  // Support legacy format (learn_item_id)
  const actualItemId = item_id || learn_item_id!

  // Check if already saved
  const { data: existing } = await supabase
    .from('saved_items')
    .select('id')
    .eq('user_id', user.id)
    .eq('item_type', item_type)
    .eq('item_id', actualItemId)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Already saved' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('saved_items')
    .insert({
      id: uuidv4(),
      user_id: user.id,
      item_type,
      item_id: actualItemId,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If saving a learning item, clear its expiration
  if (item_type === 'learning') {
    await supabase
      .from('learn_items')
      .update({ expires_at: null })
      .eq('id', actualItemId)
      .eq('user_id', user.id)
  }

  return NextResponse.json({ item: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const item_type = searchParams.get('item_type') || 'learning'
  const item_id = searchParams.get('item_id') || searchParams.get('learn_item_id')

  if (!item_id) {
    return NextResponse.json({ error: 'Missing item_id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('saved_items')
    .delete()
    .eq('user_id', user.id)
    .eq('item_type', item_type)
    .eq('item_id', item_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If unsaving a learning item, reset its expiration
  if (item_type === 'learning') {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)
    
    await supabase
      .from('learn_items')
      .update({ expires_at: expiresAt.toISOString() })
      .eq('id', item_id)
      .eq('user_id', user.id)
  }

  return NextResponse.json({ success: true })
}
