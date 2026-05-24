import { redirect } from "next/navigation";

// The "Services" feature moved from /dashboard/event-types to /dashboard/services
// as part of the redesign. Keep this redirect alive so old bookmarks and any
// stale internal links keep working.
export default function EventTypesRedirect() {
  redirect("/dashboard/services");
}
