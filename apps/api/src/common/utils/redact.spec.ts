import { redact } from './redact';

describe('redact utility', () => {
  it('redacts sensitive fields recursively', () => {
    const sensitive = {
      name: 'John',
      email: 'john@example.com',
      password: 'plain_password',
      passwordHash: '$argon2id$...',
      refreshToken: 'raw_token_value',
      tokenHash: 'sha256_hash',
      clientSecret: 'secret_123',
      nested: {
        passwordConfirmation: 'plain_password',
        safeField: 123,
      },
    };

    const sanitized = redact(sensitive);

    expect(sanitized.name).toBe('John');
    expect(sanitized.email).toBe('john@example.com');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.passwordHash).toBe('[REDACTED]');
    expect(sanitized.refreshToken).toBe('[REDACTED]');
    expect(sanitized.tokenHash).toBe('[REDACTED]');
    expect(sanitized.clientSecret).toBe('[REDACTED]');
    expect(sanitized.nested.passwordConfirmation).toBe('[REDACTED]');
    expect(sanitized.nested.safeField).toBe(123);
  });
});
