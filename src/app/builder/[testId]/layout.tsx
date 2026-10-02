import BuilderNavigation from "../../../components/navigation/builder-navigation";
export default async function BuilderLayout({ children, params }: { children: React.ReactNode; params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  return <><BuilderNavigation testId={testId} />{children}</>;
}
