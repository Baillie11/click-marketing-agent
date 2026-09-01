import { describe, expect, it } from 'vitest';
import { publicAiError } from '../src/services/ai-errors.js';

describe('public AI errors', () => {
  it('turns model verification failures into actionable safe errors', () => {
    expect(publicAiError({ status: 404, message: 'Your organization must be verified to use the model' })).toMatchObject({
      statusCode: 503,
      message: expect.stringContaining('verification'),
      actionUrl: expect.stringContaining('organization/general'),
    });
  });
  it('does not expose an unknown internal error', () => expect(publicAiError(new Error('database secret'))).toBeNull());
});
