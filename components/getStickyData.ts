import { cacheLife, cacheTag } from "next/cache";

let callCount = 0;

export async function getStickyData() {
  "use cache: sticky";
  cacheTag("my-tag");
  cacheLife("days");

  const callId = ++callCount;

  console.log(`[getStickyData] call #${callId} 🟢`);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  console.log(`[getStickyData] call #${callId} 🔴`);

  return {
    finishTime: new Date().toISOString(),
    callCount,
  };
}
