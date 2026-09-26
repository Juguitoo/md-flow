# Bitácora

A local board for the tasks you already keep in markdown. Point it at a project folder and it reads `docs/BACKLOG.md`, `docs/ROADMAP.md`, `docs/VERSIONS.md`, and the archive of closed work. The files stay the source of truth. Bitácora only shows them and writes back into the same markdown.

Open tasks are a single list. A click opens the task. Hold a row to reorder it inside its version. Closing a task can store one or more commit hashes; if that folder’s `origin` remote is on GitHub, the hash links to the commit. Versions and the roadmap are the other two views.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:47231](http://localhost:47231). Add a project with its folder path, or let Bitácora create the doc set (`docs/BACKLOG.md`, `docs/ROADMAP.md`, `docs/VERSIONS.md`, `docs/archive/`, and `docs/MAINTENANCE.md`) when the folder does not have one yet.

It watches the folder. Saving a markdown file updates the board, and actions in the board update the file. A change on another machine shows up after it lands on this disk, for example after `git pull`.

```bash
npm test
```

This is a local server with access to the folders you register. Do not expose it to the internet.
