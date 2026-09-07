import { cacheLife, cacheTag } from "next/cache";

export async function getData(slug: string) {
  "use cache";
  cacheTag("my-tag");
  cacheLife("days");

  console.log("[getData] cache miss; doing work", new Date().toISOString());
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return {
    slug,
    generatedAt: new Date().toISOString(),
    random: Math.random(),
  };
}
