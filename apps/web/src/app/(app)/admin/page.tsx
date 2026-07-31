import { ShieldWarning } from "@phosphor-icons/react/dist/ssr";
import { AdminClient, type AdminData } from "@/components/admin/admin-client";
import { apiServer } from "@/lib/api";

/** Platforma admin paneli — faqat platforma egasi (tenant) uchun. Menyuda ko'rinmaydi. */
export default async function AdminPage() {
  const res = await apiServer<AdminData>("/api/platform/overview");
  if (!res.success || !res.data) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-danger-soft text-danger">
          <ShieldWarning weight="fill" className="size-6" />
        </div>
        <h1 className="font-display text-xl font-semibold">Ruxsat yo&apos;q</h1>
        <p className="mt-2 text-sm text-muted-foreground">Bu bo&apos;lim faqat platforma administratori uchun.</p>
      </div>
    );
  }
  return <AdminClient data={res.data} />;
}
