import config from "@payload-config";
import { NextResponse } from "next/server";
import { getPayload } from "payload";

export const revalidate = 10;
export const runtime = "nodejs";

export async function GET() {
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: "pages",
    limit: 1000,
    pagination: false,
    depth: 0,
    select: { slug: true },
  });

  const slugs = docs.map((d) => d.slug).filter(Boolean);
  return NextResponse.json({ slugs });
}
