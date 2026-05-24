import { EditServiceClient } from "./client";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditServiceClient id={id} />;
}
