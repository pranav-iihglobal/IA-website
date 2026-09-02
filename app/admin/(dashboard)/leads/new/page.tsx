import { NewContactPage } from "@/components/admin/NewContactPage";

export const metadata = { title: "New lead" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <NewContactPage scope="leads" />;
}
