import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const item_type = searchParams.get('item_type')

  // Build query
  let query = supabase
    .from('saved_items')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (item_type) {
    query = query.eq('item_type', item_type)
  }

  const { data: savedItems, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch related items
  const learningIds = savedItems
    .filter(s => s.item_type === 'learning')
    .map(s => s.item_id)
  
  const lessonPlanIds = savedItems
    .filter(s => s.item_type === 'lesson_plan')
    .map(s => s.item_id)

  // Fetch learn items
  let learnItems: Record<string, unknown> = {}
  if (learningIds.length > 0) {
    const { data: items } = await supabase
      .from('learn_items')
      .select('*')
      .in('id', learningIds)
    
    if (items) {
      learnItems = items.reduce((acc, item) => {
        acc[item.id] = item
        return acc
      }, {} as Record<string, unknown>)
    }
  }

  // Fetch lesson plans
  let lessonPlans: Record<string, unknown> = {}
  if (lessonPlanIds.length > 0) {
    const { data: plans } = await supabase
      .from('lesson_plans')
      .select('*')
      .in('id', lessonPlanIds)
    
    if (plans) {
      lessonPlans = plans.reduce((acc, plan) => {
        acc[plan.id] = plan
        return acc
      }, {} as Record<string, unknown>)
    }
  }

  // Combine data
  const items = savedItems.map(saved => ({
    ...saved,
    learn_item: saved.item_type === 'learning' ? learnItems[saved.item_id] : undefined,
    lesson_plan: saved.item_type === 'lesson_plan' ? lessonPlans[saved.item_id] : undefined,
  }))

  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { item_type = 'learning', item_id, learn_item_id } = body
  
  // Support legacy format (learn_item_id)
  const actualItemId = item_id || learn_item_id

  if (!actualItemId) {
    return NextResponse.json({ error: 'Missing item_id' }, { status: 400 })
  }

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
