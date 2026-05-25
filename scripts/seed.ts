import { getPayload } from "payload";
import config from "../payload.config";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "password";

type LexicalNode = Record<string, unknown> & { type: string; version: number };

const text = (value: string): LexicalNode => ({
  mode: "normal",
  text: value,
  type: "text",
  style: "",
  detail: 0,
  format: 0,
  version: 1,
});

const link = (url: string, label: string): LexicalNode => ({
  type: "link",
  format: "",
  indent: 0,
  version: 3,
  direction: "ltr",
  fields: { linkType: "custom", url, newTab: false },
  children: [text(label)],
});

const paragraph = (...children: LexicalNode[]): LexicalNode => ({
  type: "paragraph",
  format: "",
  indent: 0,
  version: 1,
  direction: "ltr",
  textFormat: 0,
  textStyle: "",
  children,
});

const doc = (...children: LexicalNode[]) => ({
  root: {
    type: "root",
    format: "" as const,
    indent: 0,
    version: 1,
    direction: "ltr" as const,
    children,
  },
});

const PAGES = [
  {
    title: "Home",
    slug: "home",
    content: doc(
      paragraph(text("Welcome to the home page.")),
      paragraph(
        text("Other pages: "),
        link("/about", "About"),
        text(" • "),
        link("/contact", "Contact"),
      ),
      paragraph(link("/admin", "Open admin →")),
    ),
  },
  {
    title: "About",
    slug: "about",
    content: doc(paragraph(text("A short page about this project."))),
  },
  {
    title: "Contact",
    slug: "contact",
    content: doc(paragraph(text("Reach us at hello@example.com."))),
  },
];

const seed = async () => {
  const payload = await getPayload({ config });

  const { totalDocs: existingUsers } = await payload.count({
    collection: "users",
  });
  if (existingUsers === 0) {
    await payload.create({
      collection: "users",
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    payload.logger.info(
      `Created admin user: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`,
    );
  } else {
    payload.logger.info("Admin user already exists, skipping.");
  }

  for (const page of PAGES) {
    const { totalDocs } = await payload.count({
      collection: "pages",
      where: { slug: { equals: page.slug } },
    });
    if (totalDocs > 0) {
      payload.logger.info(`Page "${page.slug}" already exists, skipping.`);
      continue;
    }
    await payload.create({
      collection: "pages",
      data: {
        title: page.title,
        slug: page.slug,
        content: page.content,
      },
    });
    payload.logger.info(`Created page: ${page.slug}`);
  }

  payload.logger.info("Seed complete.");
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
