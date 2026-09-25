import { ProjectBoard } from "@/components/project-board";
import { loadDetail } from "@/lib/load";
import { connection } from "next/server";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const detail = await loadDetail(id);
  return <ProjectBoard key={id} id={id} initial={detail} />;
}
