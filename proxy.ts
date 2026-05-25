import { NextResponse, type NextRequest } from "next/server";

type SlugsResponse = { slugs: string[] };

const NOT_FOUND_PATH = "/internal-not-found";
const RENDER_PREFIX = "/render/";
const HOME_SLUG = "home";

export async function proxy(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.rewrite(new URL(RENDER_PREFIX + HOME_SLUG, origin));
  }

  if (
    pathname === NOT_FOUND_PATH ||
    pathname.startsWith(RENDER_PREFIX) ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/_next/")
  ) {
    return NextResponse.next();
  }

  const slug = pathname.substring(1);

  let slugs: string[] = [];
  try {
    const res = await fetch(new URL("/api/slugs", origin), {
      next: { revalidate: 10, tags: ["slugs"] },
    });
    if (res.ok) {
      const json = (await res.json()) as SlugsResponse;
      slugs = Array.isArray(json.slugs) ? json.slugs : [];
    }
  } catch {
    // Fail open: optimistically render. The page's notFound() is the backstop.
    return NextResponse.rewrite(new URL(RENDER_PREFIX + slug, origin));
  }

  if (slugs.includes(slug)) {
    return NextResponse.rewrite(new URL(RENDER_PREFIX + slug, origin));
  }

  return NextResponse.rewrite(new URL(NOT_FOUND_PATH, origin));
}

export const config = {
  matcher: ["/", "/((?!api/|admin|_next/|render/|.*\\..*).+)"],
};
