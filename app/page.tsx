import { getData } from "@/components/getData";
import { getStickyData } from "@/components/getStickyData";
import { revalidateTag, updateTag } from "next/cache";
import { connection } from "next/server";

export const instant = false;

let renderCount = 0;

export default async function Page() {
  const renderId = ++renderCount;
  console.log(`\n[Page] render #${renderId} 🟢`);

  await connection();
  const [data, stickyData] = await Promise.all([getData(), getStickyData()]);

  const json = JSON.stringify(
    {
      renderedAt: new Date().toISOString(),
      data,
      stickyData,
    },
    null,
    2,
  );

  console.log(`[Page] render #${renderId} 🔴\n`);

  return (
    <div>
      <pre>{json}</pre>

      <button
        onClick={async () => {
          "use server";
          console.log(await getData(Math.random().toString()));
        }}
      >
        getData()
      </button>

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
