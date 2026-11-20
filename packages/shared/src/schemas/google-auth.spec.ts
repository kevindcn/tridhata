import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { googleExchangeSchema } from './google-auth';

describe('googleExchangeSchema', () => {
  it('validates a valid non-empty ticket string', () => {
    const validTicket = { ticket: '123e4567-e89b-12d3-a456-426614174000' };
    const result = googleExchangeSchema.safeParse(validTicket);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.ticket, '123e4567-e89b-12d3-a456-426614174000');
    }
  });

  it('rejects an empty or non-string ticket', () => {
    assert.equal(googleExchangeSchema.safeParse({ ticket: '' }).success, false);
    assert.equal(googleExchangeSchema.safeParse({ ticket: 123 }).success, false);
    assert.equal(googleExchangeSchema.safeParse({}).success, false);
  });
});
