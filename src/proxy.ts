import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(req: NextRequest) {
  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedRoutes = ['/dashboard', '/settings', '/saved', '/community', '/patterns'];
  const authRoutes = ['/login', '/signup'];
  const isProtectedRoute = protectedRoutes.some((route) => req.nextUrl.pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => req.nextUrl.pathname.startsWith(route));
  const isOnboardingRoute = req.nextUrl.pathname.startsWith('/onboarding');

  const redirectWithCookies = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  };

  if (isProtectedRoute && !user) {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('redirect', req.nextUrl.pathname);
    return redirectWithCookies(redirectUrl);
  }

  if (isAuthRoute && user) {
    return redirectWithCookies(new URL('/dashboard', req.url));
  }

  // Allow onboarding for authenticated users who haven't completed it
  if (isOnboardingRoute && user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_completed_at')
      .eq('id', user.id)
      .single();

    if (profile?.onboarding_completed_at) {
      return redirectWithCookies(new URL('/dashboard', req.url));
    }
    // Allow access to onboarding if not completed
  }

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/settings/:path*',
    '/saved/:path*',
    '/community/:path*',
    '/patterns/:path*',
    '/login',
    '/signup',
    '/onboarding/:path*',
  ],
};
