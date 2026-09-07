import { cacheLife, cacheTag } from "next/cache";

let callCount = 0;

export async function getData() {
  "use cache";
  cacheTag("my-tag");
  cacheLife("days");

  console.log("[getData] cache miss; doing work");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  callCount++;

  return {
    finishTime: new Date().toISOString(),
    callCount,
  };
}
