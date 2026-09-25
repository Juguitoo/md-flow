import { ProjectBoard } from "@/components/project-board";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectBoard key={id} id={id} />;
}
