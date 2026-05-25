"use client";

import { useLivePreview } from "@payloadcms/live-preview-react";
import { RichText } from "@payloadcms/richtext-lexical/react";
import { useState } from "react";

import type { Page } from "@/payload-types";

export function LivePage({ initialPage }: { initialPage: Page }) {
  const [serverURL] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );

  const { data } = useLivePreview<Page>({
    initialData: initialPage,
    serverURL,
    depth: 2,
  });

  return (
    <>
      <h1>{data.title}</h1>
      {data.content ? <RichText data={data.content} /> : null}
    </>
  );
}
