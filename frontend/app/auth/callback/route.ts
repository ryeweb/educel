import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  // Validate redirect path to prevent open redirect vulnerability
  // Only allow relative paths that don't start with //
  const isValidRedirect = next.startsWith('/') && !next.startsWith('//')
  const safePath = isValidRedirect ? next : '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${safePath}`)
    }
  }

  // Return to home with error
  return NextResponse.redirect(`${origin}/?error=auth_error`)
}
