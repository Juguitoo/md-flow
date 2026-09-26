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
  const [picking, setPicking] = useState(false);

  async function chooseFolder() {
    setPicking(true);
    setError(null);
    try {
      const result = await api<{ path: string | null }>("/api/projects/pick", { method: "POST" });
      if (result.path) setPath(result.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open the folder picker.");
    } finally {
      setPicking(false);
    }
  }

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
          ? `${detail.name} added. Found ${files.join(", ")}.`
          : `${detail.name} added. No BACKLOG.md yet.`,
      );
      setOpen(false);
      setPath("");
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the project.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Add project</DialogTitle>
          <DialogDescription>
            Choose the project folder. If the picker does not appear, paste the path.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="project-path">Folder</Label>
            <div className="flex gap-2">
              <Input
                id="project-path"
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="D:\Hugo\AndroidStudioProjects\JuguitoReader"
                autoComplete="off"
                required
              />
              <Button
                type="button"
                variant="outline"
                disabled={picking || pending}
                onClick={() => void chooseFolder()}
              >
                {picking ? "Choosing…" : "Choose"}
              </Button>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="project-name">Name (optional)</Label>
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
            <Button type="submit" disabled={pending || picking || !path.trim()}>
              {pending ? "Looking…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
