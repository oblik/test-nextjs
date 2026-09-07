import { getData } from "@/components/getData";
import { revalidateTag, updateTag } from "next/cache";

export const instant = false;

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  console.log("[Page] rendering at", new Date().toISOString());

  const data = await getData(slug);
  console.log("[Page] done waiting for data");

  return (
    <div>
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
      <button
        onClick={async () => {
          "use server";
          revalidateTag("my-tag", "minutes");
        }}
      >
        Revalidate
      </button>

      <button
        onClick={async () => {
          "use server";
          updateTag("my-tag");
        }}
      >
        Expire
      </button>
    </div>
  );
}
