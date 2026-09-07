import { cacheLife, cacheTag } from "next/cache";

export const dynamic = "force-dynamic";

async function getData(slug: string) {
  "use cache";
  cacheTag("my-tag");
  cacheLife("minutes");

  console.log(
    "[getData] cache miss/revalidate — doing expensive work at",
    new Date().toISOString(),
  );
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return {
    slug,
    generatedAt: new Date().toISOString(),
    random: Math.random(),
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  console.log("[Page] rendering at", new Date().toISOString());

  const data = await getData(slug);

  return (
    <pre>
      {JSON.stringify(
        {
          renderedAt: new Date().toISOString(),
          cachedData: data,
        },
        null,
        2,
      )}
    </pre>
  );
}
