import { cacheLife, cacheTag } from "next/cache";

let callCount = 0;

export async function getData() {
  "use cache";
  cacheTag("my-tag");
  cacheLife("days");

  const callId = ++callCount;

  console.log(`[getData] call #${callId} 🟢`);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log(`[getData] call #${callId} 🔴`);

  return {
    finishTime: new Date().toISOString(),
    callCount,
  };
}
