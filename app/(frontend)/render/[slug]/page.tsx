import config from "@payload-config";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPayload } from "payload";

import { LivePage } from "./LivePage";

export const revalidate = 10;
export const dynamic = "error";

type Props = { params: Promise<{ slug: string }> };

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: "pages",
    where: { slug: { equals: slug } },
    limit: 1,
  });

  const page = docs[0];
  if (!page) notFound();

  return (
    <main
      style={{
        fontFamily: "system-ui",
        padding: "2rem",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <p>
        <Link href="/">← All pages</Link>
      </p>
      <LivePage initialPage={page} />
    </main>
  );
}
