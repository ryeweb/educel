import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { CreateLessonPlanSchema } from '@/lib/validations'
import { z } from 'zod'

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

  // List all lesson plans (capped at 100 for performance)
  const { data, error } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

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

  // Validate request body with Zod
  let validatedData
  try {
    const body = await req.json()
    validatedData = CreateLessonPlanSchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { learn_item_id, topic, content } = validatedData

  const planId = uuidv4()

  // Create the lesson plan with individual JSONB columns
  const { data: plan, error: planError } = await supabase
    .from('lesson_plans')
    .insert({
      id: planId,
      user_id: user.id,
      learn_item_id: learn_item_id || null,
      topic,
      goals: content.goals,
      resources: content.resources,
      exercises: content.exercises,
      daily_plan: content.daily_plan,
    })
    .select()
    .single()

  if (planError) {
    return NextResponse.json({ error: planError.message }, { status: 500 })
  }

  // Auto-save the lesson plan to saved_items
  // Check if already exists to prevent race condition/duplicates
  const { data: existing } = await supabase
    .from('saved_items')
    .select('id')
    .eq('user_id', user.id)
    .eq('item_type', 'lesson_plan')
    .eq('item_id', planId)
    .single()

  let autoSaved = false
  if (!existing) {
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
    } else {
      autoSaved = true
    }
  } else {
    // Already saved
    autoSaved = true
  }

  return NextResponse.json({ plan, autoSaved })
}
