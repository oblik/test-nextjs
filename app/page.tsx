import { getData } from "@/components/getData";
import { revalidateTag, updateTag } from "next/cache";
import { connection } from "next/server";

export const instant = false;

export default async function Page() {
  await connection();
  const data = await getData();

  const json = JSON.stringify(
    {
      renderedAt: new Date().toISOString(),
      cachedData: data,
    },
    null,
    2,
  );

  return (
    <div>
      <pre>{json}</pre>
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
