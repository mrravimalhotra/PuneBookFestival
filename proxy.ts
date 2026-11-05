import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase auth session for staff/admin routes and sends
 * signed-out visitors to the login page. This is a convenience only: every
 * page, Server Action and Route Handler re-checks authorisation itself.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Verifies the JWT (signature + expiry) and refreshes it when needed.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  const isLogin = pathname === '/staff/login';
  const isProtected = (pathname.startsWith('/staff') && !isLogin) || pathname.startsWith('/admin');

  if (isProtected && !signedIn) {
    const login = request.nextUrl.clone();
    login.pathname = '/staff/login';
    login.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: ['/staff/:path*', '/admin/:path*', '/api/staff/:path*', '/api/admin/:path*'],
};
