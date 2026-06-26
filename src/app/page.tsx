import { fetchLeads } from "@/lib/supabase";
import { Dashboard } from "@/components/dashboard";

export const revalidate = 0;

export default async function Home() {
  const leads = await fetchLeads();
  return <Dashboard initialLeads={leads} />;
}
