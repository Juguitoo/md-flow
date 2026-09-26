import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works · md-flow",
};

export default function HowPage() {
  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8 md:py-12">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">The idea</p>
      <h1 className="mt-2 font-heading text-4xl tracking-tight md:text-5xl">
        The backlog stays in the repo. The board only reads it.
      </h1>
      <div className="mt-8 space-y-5 text-base leading-relaxed text-foreground/90">
        <p>
          md-flow is a local server. It runs on your machine, reads the folders you point it at,
          and shows the tasks you already wrote in markdown. It does not replace BACKLOG.md: that
          file is still the source.
        </p>
        <h2 className="pt-4 font-heading text-3xl tracking-tight">Does it update on its own?</h2>
        <p>
          Yes, while md-flow is running on the same computer where you edit. It watches the
          project folder. As soon as you save BACKLOG.md, ROADMAP.md, or KNOWN_ISSUES.md, the
          board reads the file again. There is no reload and no sync button.
        </p>
        <p>
          The other way works too: marking a task on the board changes that line. Creating a task
          here writes it into BACKLOG.md. The editor and the web look at the same file.
        </p>
        <p>
          A change on another computer shows up only after it lands on this disk. A{" "}
          <span className="font-mono text-sm">git pull</span> does that, because the file changes
          here.
        </p>
        <h2 className="pt-4 font-heading text-3xl tracking-tight">What about commits?</h2>
        <p>
          When you mark a task done you can note the hash. md-flow stores it in the archive and,
          if that folder&apos;s <span className="font-mono text-sm">origin</span> remote is on
          GitHub, the hash opens the commit. You do not need issues or a token.
        </p>
        <h2 className="pt-4 font-heading text-3xl tracking-tight">Which files it reads</h2>
        <p>
          In the project root, and also inside <span className="font-mono text-sm">docs/</span>:
          BACKLOG.md, ROADMAP.md, KNOWN_ISSUES.md, TASKS.md, TODO.md, and ISSUES.md. A section
          named Pendiente, En curso, or Hecho (or To do, In progress, Done) places the task. A{" "}
          <span className="font-mono text-sm">[x]</span> marks it closed.
        </p>
        <p>
          If your notes live somewhere else, a <span className="font-mono text-sm">bitacora.json</span>{" "}
          in the root can list more files:
        </p>
      </div>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-card p-4 font-mono text-xs leading-relaxed ring-1 ring-foreground/10">
        {`{
  "files": [".artifacts/plans/DATA-002.md"]
}`}
      </pre>
      <div className="mt-8 space-y-5 text-base leading-relaxed">
        <h2 className="font-heading text-3xl tracking-tight">What it is not</h2>
        <p>
          It is not a manager that moves tasks into its own database, and it is not a stand-in for
          GitHub Projects. If you stop the server, the board goes away and the markdown stays
          exactly where it was.
        </p>
        <p>
          Do not expose it to the internet. Anyone who can open this site can read the folders you
          registered and write to their backlogs.
        </p>
      </div>
    </article>
  );
}
