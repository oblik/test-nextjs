import { LayoutChild } from "@/app/LayoutChild";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <LayoutChild>{children}</LayoutChild>
      </body>
    </html>
  );
}
