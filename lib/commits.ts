const HASH = /\b[0-9a-f]{7,40}\b/gi;

export function extractHashes(value: string): string[] {
  const seen = new Set<string>();
  const hashes: string[] = [];
  for (const match of value.match(HASH) ?? []) {
    const hash = match.toLowerCase();
    if (seen.has(hash)) continue;
    seen.add(hash);
    hashes.push(hash);
  }
  return hashes;
}

export function commitUrl(repo: string, hash: string): string {
  return `https://github.com/${repo}/commit/${hash}`;
}

export function withCommitNote(resolution: string, commits: string): string {
  const hashes = extractHashes(commits);
  const body = resolution.trim();
  if (hashes.length === 0) return body;
  const prefix = hashes.map((hash) => `\`${hash}\``).join(" ");
  if (!body) return `${prefix}.`;
  const already = hashes.every((hash) => body.toLowerCase().includes(hash));
  if (already) return body;
  return `${prefix}. ${body}`;
}
