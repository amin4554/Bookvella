import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <AppShell active="Settings" title="Settings">
      <section>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Manage your public profile details.
        </p>
      </section>
      <form className="mt-6 max-w-xl rounded-xl border border-[#EEE7DF] bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <Field label="Name" value="Jane Smith" />
          <Field label="Public slug" value="jane-smith" />
          <label className="block">
            <span className="text-sm font-medium">Timezone</span>
            <select className="mt-1 h-10 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm">
              <option>America / New_York</option>
              <option>Europe / Berlin</option>
              <option>UTC</option>
            </select>
          </label>
        </div>
        <Button className="mt-6 h-10 rounded-lg bg-[#FF5F63] px-5 font-semibold text-white">
          Save changes
        </Button>
      </form>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        defaultValue={value}
        className="mt-1 h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#FF5F63] focus:ring-2 focus:ring-[#FF5F63]/15"
      />
    </label>
  );
}
