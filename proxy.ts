import { NextResponse, type NextRequest } from "next/server";

type SlugsResponse = { slugs: string[] };

const NOT_FOUND_PATH = "/internal-not-found";

export async function proxy(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  if (
    pathname === "/" ||
    pathname === NOT_FOUND_PATH ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/_next/")
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 1) {
    return NextResponse.rewrite(new URL(NOT_FOUND_PATH, origin));
  }
  const seg = segments[0];

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
    return NextResponse.next();
  }

  if (slugs.includes(seg)) {
    return NextResponse.next();
  }

  return NextResponse.rewrite(new URL(NOT_FOUND_PATH, origin));
}

export const config = {
  matcher: ["/((?!api/|admin|_next/|.*\\..*|$).+)"],
};
