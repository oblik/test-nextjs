import config from "@payload-config";
import { RichText } from "@payloadcms/richtext-lexical/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPayload } from "payload";

export const revalidate = 10;

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
      <h1>{page.title}</h1>
      {page.content ? <RichText data={page.content as never} /> : null}
    </main>
  );
}
