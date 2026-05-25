import { revalidatePath, revalidateTag } from "next/cache";
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from "payload";

// Wrap so CLI runs (seed, generate:types) without a Next request context
// don't crash — revalidateTag/revalidatePath throw an Invariant when called
// outside a request.
function bust(tags: string[], paths: string[]) {
  try {
    for (const t of tags) revalidateTag(t, "max");
    for (const p of paths) revalidatePath(p);
  } catch {
    // Not in a Next request context — nothing to invalidate.
  }
}

export const pagesAfterChange: CollectionAfterChangeHook = ({
  doc,
  previousDoc,
  operation,
}) => {
  const paths: string[] = ["/api/slugs"];
  if (doc?.slug) paths.push("/" + doc.slug);
  if (
    operation === "update" &&
    previousDoc?.slug &&
    previousDoc.slug !== doc.slug
  ) {
    paths.push("/" + previousDoc.slug);
  }
  bust(["slugs"], paths);
  return doc;
};

export const pagesAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  const paths: string[] = ["/api/slugs"];
  if (doc?.slug) paths.push("/" + doc.slug);
  bust(["slugs"], paths);
  return doc;
};
