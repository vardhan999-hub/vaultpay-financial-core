import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// HV: route guard — enforces RBAC at middleware level
// client cannot reach admin routes even by typing URL directly
const PUBLIC_PATHS = ['/login', '/403', '/register', '/forgot-password']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // HV: allowlist of public paths — keeps /register and /forgot-password
  // (if added later) from being redirected even though they aren't built
  // yet this sprint; avoids a future regression
  if (!user && !PUBLIC_PATHS.includes(path)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && path.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/403', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  // HV: excludes API routes and all static assets from middleware processing
  // API routes are independently protected inside each route handler
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|login|403|register|forgot-password).*)',
  ],
}