/**
 * Resolve "Không thuộc dự án nào" (inbox / DFLT).
 * Never fall back to the first listed project (often StorymeeTeam).
 */
export type ProjectLike = {
  id: string;
  name?: string | null;
  key?: string | null;
  identifier?: string | null;
};

const INBOX_IDENTS = new Set(['DFLT', 'INBOX', 'NONE', 'NOPROJ']);

export function isNoProjectSentinel(v: unknown): boolean {
  if (v == null || v === '') return true;
  const s = String(v).trim().toLowerCase();
  return [
    'all',
    'default',
    'default_no_project',
    'none',
    'null',
    'undefined',
    'no_project',
    'no-project',
    'inbox',
    'dflt',
  ].includes(s);
}

export function resolveInboxProjectId(projects: ProjectLike[]): string | null {
  if (!Array.isArray(projects) || projects.length === 0) return null;
  const byIdent = projects.find((p) =>
    INBOX_IDENTS.has(String(p.identifier || p.key || '').toUpperCase())
  );
  if (byIdent) return byIdent.id;
  const byName = projects.find((p) => {
    const n = String(p.name || '').toLowerCase();
    return (
      n.includes('không thuộc dự án') ||
      n.includes('khong thuoc du an') ||
      n.includes('no project') ||
      n.includes('mặc định') ||
      n.includes('mac dinh')
    );
  });
  return byName?.id || null;
}

/** Project id to use when creating a task from current filter/context. */
export function resolveCreateProjectId(
  selectedOrActiveId: string | null | undefined,
  projects: ProjectLike[]
): string | null {
  if (!isNoProjectSentinel(selectedOrActiveId)) {
    const exists = projects.some((p) => p.id === selectedOrActiveId);
    if (exists) return selectedOrActiveId as string;
  }
  return resolveInboxProjectId(projects);
}
