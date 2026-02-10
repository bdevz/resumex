// Configuration-specific types
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ConfigLoader {
  load(path: string): Promise<any>;
  validate(config: any): ConfigValidationResult;
}