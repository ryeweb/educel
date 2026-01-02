import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { UpdateUserPrefsSchema } from '@/lib/validations'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: prefs, error } = await supabase
    .from('user_prefs')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ prefs }, {
    headers: {
      'Cache-Control': 'private, max-age=3600, stale-while-revalidate=7200',
    },
  })
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
    validatedData = UpdateUserPrefsSchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { preferred_topics, depth, theme } = validatedData

  const updateData: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  }

  if (preferred_topics !== undefined) {
    updateData.preferred_topics = preferred_topics
  }
  if (depth !== undefined) {
    updateData.depth = depth
  }
  if (theme !== undefined) {
    updateData.theme = theme
  }

  const { data, error } = await supabase
    .from('user_prefs')
    .upsert(updateData)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ prefs: data })
}
