import ReviewPublishClient from "./review-publish-client.tsx";

type Props = { params: Promise<{ testId: string }> };

export default async function ReviewPublishPage({ params }: Props) {
  const { testId } = await params;
  return <ReviewPublishClient testId={testId} />;
}
