import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ user: null, prefs: null })
  }

  const { data: prefs } = await supabase
    .from('user_prefs')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ user, prefs })
}
