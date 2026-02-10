// Orchestration-specific types
export interface DeploymentPhase {
  name: string;
  execute(): Promise<void>;
}

export interface OrchestrationContext {
  config: any;
  resources: Map<string, any>;
  errors: Error[];
}