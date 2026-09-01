export type ComparableIssue = {
  fingerprint: string;
  title: string;
  page: { url: string } | null;
};

export function stableIssueKey(issue: ComparableIssue) {
  const checkCode = issue.fingerprint.split(':').at(-1) ?? issue.title;
  return `${issue.page?.url ?? 'site'}|${checkCode}`;
}

export function compareAuditIssues(current: ComparableIssue[], previous: ComparableIssue[]) {
  const currentKeys = new Set(current.map(stableIssueKey));
  const previousKeys = new Set(previous.map(stableIssueKey));
  return {
    current: currentKeys.size,
    previous: previousKeys.size,
    fixed: [...previousKeys].filter((key) => !currentKeys.has(key)).length,
    stillPresent: [...currentKeys].filter((key) => previousKeys.has(key)).length,
    new: [...currentKeys].filter((key) => !previousKeys.has(key)).length,
  };
}
