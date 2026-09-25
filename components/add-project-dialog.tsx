"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBitacora } from "@/components/bitacora-provider";
import { api } from "@/lib/client";
import type { ProjectDetail } from "@/lib/types";
import { useState } from "react";
import { toast } from "sonner";

export function AddProjectDialog({ trigger }: { trigger: React.ReactNode }) {
  const { refresh } = useBitacora();
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const detail = await api<ProjectDetail>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ path, name }),
      });
      await refresh();
      const files = detail.files.map((file) => file.path);
      toast(
        files.length
          ? `${detail.name} añadido. Encontré ${files.join(", ")}.`
          : `${detail.name} añadido. No encontré BACKLOG.md todavía.`,
      );
      setOpen(false);
      setPath("");
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude añadir el proyecto.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Añadir proyecto</DialogTitle>
          <DialogDescription>
            La carpeta donde ya tienes BACKLOG.md, ROADMAP.md o KNOWN_ISSUES.md.
            Puede ser la de juguitoReader o cualquier otra.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="project-path">Ruta de la carpeta</Label>
            <Input
              id="project-path"
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder="/home/hugo/juguitoReader"
              autoComplete="off"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="project-name">Nombre (opcional)</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="juguitoReader"
              autoComplete="off"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Buscando…" : "Añadir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
