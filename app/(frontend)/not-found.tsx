import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        fontFamily: "system-ui",
        padding: "2rem",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <h1>404 — Page not found</h1>
      <p>That page doesn’t exist.</p>
      <p>
        <Link href="/">← Back home</Link>
      </p>
    </main>
  );
}
