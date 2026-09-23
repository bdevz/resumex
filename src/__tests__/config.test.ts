import { describe, it, expect } from 'vitest';
import { validateConfig } from '../config/validator';

describe('validateConfig legacy smoke checks', () => {

  it('should validate a valid configuration', () => {
    const config = {
      application: {
        name: 'test-app',
        type: 'frontend'
      },
      aws: {
        region: 'us-east-1'
      },
      frontend: {
        source_dir: './frontend'
      },
      deployment: {
        enable_monitoring: true
      }
    };

    const result = validateConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid configuration', () => {
    const config = {
      application: {
        // missing required name field
        type: 'invalid-type'
      }
    };

    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});