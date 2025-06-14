export const versionParts = (version: string): { version: number[], prerelease: string | undefined, metadata: string | undefined } => {
  const [versionPartial, metadata] = version.split('+') as [string, string | undefined];
  const [versionPartial2, prerelease] = versionPartial.split('-') as [string, string | undefined];
  return {
    version: versionPartial2.split('.').map(part => parseInt(part.trim(), 10)),
    prerelease: prerelease,
    metadata: metadata,
  }
}

export const compareVersions = (a: string, b: string): -1 | 0 | 1 => {
  const aParts = versionParts(a);
  const bParts = versionParts(b);

  // Compare version numbers first
  for (let i = 0; i < Math.max(aParts.version.length, bParts.version.length); i++) {
    const aPart = aParts.version[i] || 0;
    const bPart = bParts.version[i] || 0;

    if (aPart !== bPart) {
      return aPart < bPart ? -1 : 1;
    }
  }

  // Handle prerelease comparison
  // A version without prerelease has higher precedence than one with prerelease
  if (aParts.prerelease === undefined && bParts.prerelease !== undefined) { return 1; }
  if (aParts.prerelease !== undefined && bParts.prerelease === undefined) { return -1; }
  
  // If both have prerelease, compare lexicographically
  if (aParts.prerelease !== undefined && bParts.prerelease !== undefined) {
    return aParts.prerelease < bParts.prerelease
      ? -1
      : aParts.prerelease > bParts.prerelease
        ? 1
        : 0;
  }

  return 0;
}