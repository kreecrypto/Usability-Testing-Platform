import PostTaskQuestionBuilderClient from "./post-task-question-builder-client.tsx";

type Props = { params: Promise<{ testId: string }> };

export default async function PostTaskQuestionsPage({ params }: Props) {
  const { testId } = await params;
  return <PostTaskQuestionBuilderClient testId={testId} />;
}
