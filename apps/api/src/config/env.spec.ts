import { envSchema } from './env';

describe('envSchema Google OAuth configuration', () => {
  const baseConfig = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/tridhata',
    JWT_ACCESS_SECRET: '12345678901234567890123456789012',
    CORS_ORIGIN: 'http://localhost:5173',
    GOOGLE_SA_EMAIL: 'sa@tridhata.iam.gserviceaccount.com',
    GOOGLE_SA_PRIVATE_KEY: 'test-private-key',
  };

  it('parses Google OAuth variables when provided', () => {
    const parsed = envSchema.parse({
      ...baseConfig,
      GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'test-client-secret-12345',
      GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
    });

    expect(parsed.GOOGLE_CLIENT_ID).toBe('test-client-id.apps.googleusercontent.com');
    expect(parsed.GOOGLE_CLIENT_SECRET).toBe('test-client-secret-12345');
    expect(parsed.GOOGLE_CALLBACK_URL).toBe('http://localhost:3000/auth/google/callback');
  });

  it('allows Google OAuth variables to be optional in environments where SSO is not configured yet', () => {
    const parsed = envSchema.parse(baseConfig);
    expect(parsed.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(parsed.GOOGLE_CLIENT_SECRET).toBeUndefined();
    expect(parsed.GOOGLE_CALLBACK_URL).toBeUndefined();
  });
});

