import MethodBuilderClient from "./method-builder-client.tsx";

export default async function MethodBuilderPage({ params }: { params: Promise<{ testId: string }> }) {
  return <MethodBuilderClient testId={(await params).testId} />;
}
