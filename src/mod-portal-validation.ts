import { validateDependencyAgainstPortal, type ValidationError, type ValidationWarning } from './mod-portal-api.js';
import { parsedToInternal, type AnyJson } from './info-json-schema.js';

export const validateModPortal = async <T extends AnyJson>(
  json: T,
  options: {
    validateDependencies?: boolean;
    parallel?: boolean;
  } = {}
): Promise<{
  errors: Array<ValidationError>;
  warnings: Array<ValidationWarning>;
}> => {
  const { validateDependencies = true, parallel = true } = options;
  
  if (!validateDependencies) {
    return { errors: [], warnings: [] };
  }
  
  const parsed = parsedToInternal(json);
  
  const allErrors: Array<ValidationError> = [];
  const allWarnings: Array<ValidationWarning> = [];
  
  if (parallel) {
    // Validate all dependencies in parallel
    const results = await Promise.all(
      parsed.dependencies.map(dep => validateDependencyAgainstPortal(dep))
    );
    
    for (const result of results) {
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }
  } else {
    // Validate dependencies sequentially
    for (const dependency of parsed.dependencies) {
      const result = await validateDependencyAgainstPortal(dependency);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }
  }
  
  return { errors: allErrors, warnings: allWarnings };
};

export const validateModPortalSafe = async <T extends AnyJson>(
  json: T,
  options: {
    validateDependencies?: boolean;
    parallel?: boolean;
    timeout?: number;
  } = {}
): Promise<{
  errors: Array<ValidationError>;
  warnings: Array<ValidationWarning>;
  validationSkipped?: boolean;
}> => {
  const { timeout = 30000 } = options;
  
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Validation timeout')), timeout);
    });
    
    const validationPromise = validateModPortal(json, options);
    
    return await Promise.race([validationPromise, timeoutPromise]);
  } catch (error) {
    return {
      errors: [],
      warnings: [],
      validationSkipped: true
    };
  }
}; 