import { describe, it, expect } from 'vitest';
import { ConfigValidator } from '../config/validator';

describe('ConfigValidator', () => {
  const validator = new ConfigValidator();

  it('should validate a valid configuration', () => {
    const config = {
      application: {
        name: 'test-app',
        type: 'fullstack'
      },
      aws: {
        region: 'us-east-1'
      },
      deployment: {
        enable_monitoring: true
      }
    };

    const result = validator.validate(config);
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

    const result = validator.validate(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});