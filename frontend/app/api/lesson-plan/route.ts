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
  const id = searchParams.get('id')
  const learn_item_id = searchParams.get('learn_item_id')

  if (id) {
    const { data, error } = await supabase
      .from('lesson_plans')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ plan: data })
  }

  if (learn_item_id) {
    const { data, error } = await supabase
      .from('lesson_plans')
      .select('*')
      .eq('learn_item_id', learn_item_id)
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plan: data || null })
  }

  // List all lesson plans
  const { data, error } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ plans: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { learn_item_id, title, topic, content } = body

  const planId = uuidv4()

  // Create the lesson plan
  const { data: plan, error: planError } = await supabase
    .from('lesson_plans')
    .insert({
      id: planId,
      user_id: user.id,
      learn_item_id: learn_item_id || null,
      title: title || `Lesson Plan: ${topic}`,
      topic,
      content,
    })
    .select()
    .single()

  if (planError) {
    return NextResponse.json({ error: planError.message }, { status: 500 })
  }

  // Auto-save the lesson plan to saved_items
  const savedId = uuidv4()
  const { error: saveError } = await supabase
    .from('saved_items')
    .insert({
      id: savedId,
      user_id: user.id,
      item_type: 'lesson_plan',
      item_id: planId,
    })

  if (saveError) {
    console.error('Error auto-saving lesson plan:', saveError.message)
    // Don't fail the request, just log the error
  }

  return NextResponse.json({ plan, autoSaved: !saveError })
}
