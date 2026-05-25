import { notFound } from "next/navigation";

export const revalidate = false;

export default function NotFoundTrigger() {
  notFound();
}
