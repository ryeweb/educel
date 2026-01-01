import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('saved_items')
    .select(`
      *,
      learn_item:learn_items(*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

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

  const body = await req.json()
  const { learn_item_id } = body

  // Check if already saved
  const { data: existing } = await supabase
    .from('saved_items')
    .select('id')
    .eq('user_id', user.id)
    .eq('learn_item_id', learn_item_id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Already saved' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('saved_items')
    .insert({
      id: uuidv4(),
      user_id: user.id,
      learn_item_id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
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
  const learn_item_id = searchParams.get('learn_item_id')

  if (!learn_item_id) {
    return NextResponse.json({ error: 'Missing learn_item_id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('saved_items')
    .delete()
    .eq('user_id', user.id)
    .eq('learn_item_id', learn_item_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
