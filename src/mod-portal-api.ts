import { compareVersions } from "./compare-versions.js";
import type { Dependency } from "./info-json-schema.js";

type ModPortalRelease = {
  version: string;
  factorio_version: string;
  released_at: string;
  download_url: string;
  file_name: string;
  sha1: string;
  info_json: {
    factorio_version: string;
  };
};

type ModPortalResponse = {
  name: string;
  releases: ModPortalRelease[];
  title: string;
  summary: string;
  owner: string;
  downloads_count: number;
  score: number;
  category: string;
  thumbnail?: string;
  last_highlighted_at?: string;
};

export type ValidationError = {
  type: 
    | 'invalid-dependency'
    | 'invalid-version-format'
    | 'mod-not-found'
    | 'version-not-found'
    | 'network-error'
    | 'timeout-error';
  field?: string;
  message: string;
  details?: string;
  suggestion?: string;
  dependency?: string;
  value?: unknown;
};

export type ValidationWarning = {
  type: 'mod-not-found' | 'version-not-available';
  message: string;
  field?: string;
  dependency?: string;
  suggestion?: string;
};

const API_TIMEOUT = 10000; // 10 seconds

async function fetchModInfo(modName: string): Promise<{ 
  data: ModPortalResponse | null; 
  error?: ValidationError 
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    
    const response = await fetch(`https://mods.factorio.com/api/mods/${modName}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 404) {
        return {
          data: null,
          error: {
            type: 'mod-not-found',
            message: `Mod '${modName}' not found on Factorio mod portal`,
            dependency: modName,
            suggestion: "Check the mod name spelling or verify it exists on the mod portal"
          }
        };
      }
      
      return {
        data: null,
        error: {
          type: 'network-error',
          message: `HTTP ${response.status} error fetching mod '${modName}'`,
          dependency: modName
        }
      };
    }
    
    const data: ModPortalResponse = await response.json();
    return { data };
    
  } catch (error) {
    const errorType = error instanceof Error && error.name === 'AbortError' ? 'timeout-error' : 'network-error';
    const errorMessage = errorType === 'timeout-error' 
      ? `Timeout fetching mod '${modName}' from Factorio mod portal`
      : `Network error fetching mod '${modName}': ${error instanceof Error ? error.message : 'Unknown error'}`;
    
    return {
      data: null,
      error: {
        type: errorType,
        message: errorMessage,
        dependency: modName,
        suggestion: errorType === 'timeout-error' 
          ? "Check your internet connection or try again later"
          : "Verify your internet connection and that the mod portal is accessible"
      }
    };
  }
}

function checkVersionExists(releases: ModPortalRelease[], version: string, operator: string): {
  exists: boolean;
  availableVersions: string[];
} {
  const availableVersions = releases.map(r => r.version).sort((a, b) => compareVersions(b, a));
  
  if (!operator) return { exists: true, availableVersions };
  
  let exists = false;
  switch (operator) {
    case '=':
      exists = availableVersions.includes(version);
      break;
    case '>':
      exists = availableVersions.some(v => compareVersions(v, version) === 1);
      break;
    case '>=':
      exists = availableVersions.some(v => compareVersions(v, version) >= 0);
      break;
    case '<':
      exists = availableVersions.some(v => compareVersions(v, version) === -1);
      break;
    case '<=':
      exists = availableVersions.some(v => compareVersions(v, version) <= 0);
      break;
  }
  
  return { exists, availableVersions };
}

export async function validateDependencyAgainstPortal(dependency: Dependency): Promise<{
  errors: ValidationError[];
  warnings: ValidationWarning[];
}> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // Skip validation for base game and built-in mods
  const builtInMods = ['base', 'core'];
  if (builtInMods.includes(dependency.name)) {
    return { errors, warnings };
  }
  
  // Skip mod portal validation for incompatible dependencies
  if (dependency.relation === '!') {
    return { errors, warnings };
  }
  
  const fetchResult = await fetchModInfo(dependency.name);
  if (fetchResult.error) {
    if (fetchResult.error.type === 'mod-not-found') {
      // Mod not found is a warning, not an error
      warnings.push({
        type: 'mod-not-found',
        message: fetchResult.error.message,
        dependency: dependency.name,
        suggestion: fetchResult.error.suggestion || 'Check the mod name and try again'
      });
    } else {
      // Network/timeout errors are actual errors
      errors.push(fetchResult.error);
    }
    return { errors, warnings };
  }
  
  if (!fetchResult.data) {
    warnings.push({
      type: 'mod-not-found',
      message: `Mod '${dependency.name}' not found on Factorio mod portal`,
      dependency: dependency.name,
      suggestion: "Check the mod name spelling or verify it exists on the mod portal"
    });
    return { errors, warnings };
  }
  
  if (dependency.compare && dependency.version) {
    const versionString = `${dependency.version.major}.${dependency.version.minor}.${dependency.version.patch}`;
    const versionCheck = checkVersionExists(fetchResult.data.releases, versionString, dependency.compare);
    if (!versionCheck.exists) {
      const availableVersionsStr = versionCheck.availableVersions.slice(0, 5).join(', ');
      const moreVersions = versionCheck.availableVersions.length > 5 ? ` (and ${versionCheck.availableVersions.length - 5} more)` : '';
      
      warnings.push({
        type: 'version-not-available',
        message: `Version constraint '${dependency.compare} ${versionString}' not satisfied for mod '${dependency.name}'`,
        dependency: dependency.name,
        suggestion: `Available versions: ${availableVersionsStr}${moreVersions}`
      });
    }
  }
  
  return { errors, warnings };
} 