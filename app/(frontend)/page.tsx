import config from "@payload-config";
import Link from "next/link";
import { getPayload } from "payload";

export default async function HomePage() {
  const payload = await getPayload({ config });
  const { docs: pages } = await payload.find({
    collection: "pages",
    limit: 100,
    sort: "title",
  });

  return (
    <main
      style={{
        fontFamily: "system-ui",
        padding: "2rem",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <h1>Pages</h1>
      {pages.length === 0 ? (
        <p>
          No pages yet. Run <code>pnpm seed</code> or create one in the{" "}
          <Link href="/admin">admin</Link>.
        </p>
      ) : (
        <ul>
          {pages.map((page) => (
            <li key={page.id}>
              <Link href={`/${page.slug}`}>{page.title}</Link>
            </li>
          ))}
        </ul>
      )}
      <p style={{ marginTop: "2rem" }}>
        <Link href="/admin">Open admin →</Link>
      </p>
    </main>
  );
}
