import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedPaths = ["/drafts", "/brand-voice"];

function isProtectedPath(pathname: string) {
  return protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);

            response = NextResponse.next({
              request,
            });

            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  /*
    Validate the auth session with Supabase rather than trusting an
    unverified client-side value.
  */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const redirectUrl = request.nextUrl.clone();

    redirectUrl.pathname = "/sign-in";
    redirectUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );

    return NextResponse.redirect(redirectUrl);
  }

  if (user && request.nextUrl.pathname === "/sign-in") {
    const nextPath = request.nextUrl.searchParams.get("next");

    if (nextPath?.startsWith("/") && !nextPath.startsWith("//")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = nextPath;
      redirectUrl.search = "";

      return NextResponse.redirect(redirectUrl);
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";

    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
