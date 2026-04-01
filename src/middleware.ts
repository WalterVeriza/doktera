import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── ADMIN — géré côté client, bypass total ────────────────────────────────
  if (pathname.startsWith('/admin')) return NextResponse.next()

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // ── NON CONNECTÉ → login ──────────────────────────────────────────────────
  if (!user) {
    if (
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/clinique') && pathname !== '/clinique'
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
    return response
  }

  // ── CONNECTÉ → vérifier le rôle pour les dashboards ──────────────────────
  if (pathname.startsWith('/dashboard')) {
    const { data: profil } = await supabase
      .from('profils')
      .select('role')
      .eq('id', user.id)
      .single()

    const { data: clinique } = await supabase
      .from('cliniques')
      .select('id')
      .eq('admin_id', user.id)
      .maybeSingle()

    const role = profil?.role
    const estAdminClinique = !!clinique

    if (pathname.startsWith('/dashboard/patient') && role === 'medecin' && !estAdminClinique) {
      return NextResponse.redirect(new URL('/dashboard/medecin', request.url))
    }
    if (pathname.startsWith('/dashboard/patient') && estAdminClinique) {
      return NextResponse.redirect(new URL('/dashboard/clinique', request.url))
    }
    if (pathname.startsWith('/dashboard/medecin') && estAdminClinique) {
      return NextResponse.redirect(new URL('/dashboard/clinique', request.url))
    }
    if (pathname.startsWith('/dashboard/medecin') && role === 'patient') {
      return NextResponse.redirect(new URL('/dashboard/patient', request.url))
    }
    if (pathname.startsWith('/dashboard/clinique') && !estAdminClinique) {
      if (role === 'medecin') return NextResponse.redirect(new URL('/dashboard/medecin', request.url))
      return NextResponse.redirect(new URL('/dashboard/patient', request.url))
    }
  }

  // ── DÉJÀ CONNECTÉ → pas besoin d'aller sur /login ────────────────────────
  if (pathname === '/login') {
    const { data: profil } = await supabase
      .from('profils')
      .select('role')
      .eq('id', user.id)
      .single()

    const { data: clinique } = await supabase
      .from('cliniques')
      .select('id')
      .eq('admin_id', user.id)
      .maybeSingle()

    if (clinique) return NextResponse.redirect(new URL('/dashboard/clinique', request.url))
    if (profil?.role === 'medecin') return NextResponse.redirect(new URL('/dashboard/medecin', request.url))
    return NextResponse.redirect(new URL('/dashboard/patient', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/clinique/:path*',
    '/admin/:path*',
  ],
}