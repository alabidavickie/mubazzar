import { requireRole, STAFF_ROLES } from "@/server/session";

export const metadata = { title: "Dashboard" };

// Placeholder — replaced by the dashboard workstream.
export default async function AdminDashboard() {
  const session = await requireRole(STAFF_ROLES, "/admin");
  return (
    <div>
      <h1 className="text-headline-md font-bold text-navy">Welcome, {session.fullName ?? "team"}</h1>
      <p className="text-body-md text-ink-muted">Dashboard coming soon.</p>
    </div>
  );
}
