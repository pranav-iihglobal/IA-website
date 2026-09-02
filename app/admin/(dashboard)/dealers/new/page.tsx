import { NewContactPage } from "@/components/admin/NewContactPage";

export const metadata = { title: "New dealer" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <NewContactPage scope="dealers" />;
}
