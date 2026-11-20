# Google SSO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement enterprise-grade Google SSO (Single Sign-On) using OAuth 2.0 Authorization Code Flow for Tridhata Agro, enforcing a strict pre-provisioned account policy with smooth frontend UX and complete audit logging.

**Architecture:** OAuth 2.0 Authorization Code Flow with back-channel code exchange via `googleapis` (`OAuth2Client`). The backend initiates authentication with CSRF state cookies, exchanges authorization codes directly server-to-server with Google, verifies Google ID tokens, authenticates against existing active database users, and delivers session credentials via secure HTTP-only cookies and a single-use exchange ticket. The frontend SPA features a branded Google login button, error banner feedback, and a dedicated callback transition page.

**Tech Stack:** 
- Backend: NestJS 11, Fastify 5, `@prisma/client` 6, `googleapis`, `@nestjs/jwt`, `pino`
- Frontend: React 19, Vite 6, React Router 7, Tailwind CSS 4, Radix UI, Lucide Icons, Vitest, Testing Library
- Shared: TypeScript 5.8, Zod 3.24

## Global Constraints

- Pre-provisioned only: Google account email must already exist in Tridhata PostgreSQL database and `active === true`.
- Zero token leakage in front-channel: JWT `accessToken` is never passed in URL query parameters; a single-use random ticket with 60-second TTL is exchanged via `POST /auth/google/exchange`.
- Fastify & HTTP-Only cookies: Refresh token is stored in cookie `rt` (`httpOnly: true, sameSite: 'lax', path: '/auth'`). CSRF state is stored in cookie `oauth_state` (`httpOnly: true, sameSite: 'lax', maxAge: 600`).
- TDD strictness: Every task must write failing tests first, verify failure, implement minimal code, verify pass, and commit.
- No disruption to existing local auth: Password authentication (`POST /auth/login`), password change, and refresh rotation remain fully operational.

---

### Task 1: Shared Schema & Types for Google Auth Exchange

**Files:**
- Create: `packages/shared/src/schemas/google-auth.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/schemas/google-auth.spec.ts`

**Interfaces:**
- Consumes: Zod schema library
- Produces: `googleExchangeSchema`, `GoogleExchangeDto`, `GoogleAuthError` type

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared/src/schemas/google-auth.spec.ts
import { googleExchangeSchema } from './google-auth';

describe('googleExchangeSchema', () => {
  it('validates a valid UUID ticket', () => {
    const validTicket = { ticket: '123e4567-e89b-12d3-a456-426614174000' };
    const result = googleExchangeSchema.safeParse(validTicket);
    expect(result.success).toBe(true);
  });

  it('rejects an empty or non-string ticket', () => {
    expect(googleExchangeSchema.safeParse({ ticket: '' }).success).toBe(false);
    expect(googleExchangeSchema.safeParse({ ticket: 123 }).success).toBe(false);
    expect(googleExchangeSchema.safeParse({}).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tridhata/shared test` (or `npx vitest run src/schemas/google-auth.spec.ts` / `tsc`)
Expected: FAIL with module `./google-auth` not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/shared/src/schemas/google-auth.ts
import { z } from 'zod';

export const googleExchangeSchema = z.object({
  ticket: z.string().min(1, { message: 'Tiket autentikasi wajib diisi' }),
});

export type GoogleExchangeDto = z.infer<typeof googleExchangeSchema>;

export type GoogleAuthErrorCode =
  | 'UNREGISTERED_ACCOUNT'
  | 'ACCOUNT_INACTIVE'
  | 'STATE_MISMATCH'
  | 'GOOGLE_AUTH_CANCELLED'
  | 'EMAIL_NOT_VERIFIED'
  | 'AUTH_FAILED';
```

Export in `packages/shared/src/schemas/index.ts` and `packages/shared/src/index.ts`.
Build shared package: `pnpm --filter @tridhata/shared build`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tridhata/shared build`
Expected: PASS with compiled `./dist`.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas/google-auth.ts packages/shared/src/schemas/google-auth.spec.ts packages/shared/src/schemas/index.ts
git commit -m "feat(shared): add google sso exchange schema and types"
```

---

### Task 2: Backend Environment Configuration for Google OAuth

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Modify: `.env.example`
- Test: `apps/api/src/config/env.spec.ts`

**Interfaces:**
- Consumes: Node environment variables
- Produces: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` in `Env`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/config/env.spec.ts
import { envSchema } from './env';

describe('envSchema Google OAuth', () => {
  const baseEnv = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/tridhata',
    JWT_ACCESS_SECRET: '12345678901234567890123456789012',
    CORS_ORIGIN: 'http://localhost:5173',
    GOOGLE_SA_EMAIL: 'sa@tridhata.iam.gserviceaccount.com',
    GOOGLE_SA_PRIVATE_KEY: 'test-private-key',
  };

  it('accepts optional google oauth configuration', () => {
    const parsed = envSchema.parse({
      ...baseEnv,
      GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
    });

    expect(parsed.GOOGLE_CLIENT_ID).toBe('test-client-id.apps.googleusercontent.com');
    expect(parsed.GOOGLE_CLIENT_SECRET).toBe('test-client-secret');
    expect(parsed.GOOGLE_CALLBACK_URL).toBe('http://localhost:3000/auth/google/callback');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest --runInBand src/config/env.spec.ts`
Expected: FAIL because `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are not in `envSchema`.

- [ ] **Step 3: Write minimal implementation**

Update `apps/api/src/config/env.ts`:
```typescript
GOOGLE_CLIENT_ID: z.string().optional(),
GOOGLE_CLIENT_SECRET: z.string().optional(),
GOOGLE_CALLBACK_URL: z.string().url().optional(),
```
And add documentation in `.env.example`:
```ini
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest --runInBand src/config/env.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/config/env.ts apps/api/src/config/env.spec.ts .env.example
git commit -m "feat(api): add google oauth client configuration to env schema"
```

---

### Task 3: Backend Google SSO Service Logic & Ticket Exchange

**Files:**
- Create: `apps/api/src/modules/auth/google-oauth.service.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/modules/auth/auth.module.ts`
- Test: `apps/api/src/modules/auth/google-oauth.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `AuditService`, `JwtService`, `googleapis`
- Produces: 
  - `getAuthorizationUrl(): { url: string; state: string }`
  - `handleCallback(code: string, state: string, cookieState: string, ctx: ReqCtx): Promise<{ ticket: string; rawRefreshToken: string; user: AuthUser }>`
  - `exchangeTicket(ticket: string): { accessToken: string; user: AuthUser }`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/modules/auth/google-oauth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { GoogleOAuthService } from './google-oauth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtService } from '@nestjs/jwt';

describe('GoogleOAuthService', () => {
  let service: GoogleOAuthService;
  let prisma: PrismaService;
  let audit: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleOAuthService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn(), update: jest.fn() },
            refreshToken: { create: jest.fn() },
            $transaction: jest.fn((cb) => cb(prisma)),
          },
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mock-jwt') },
        },
      ],
    }).compile();

    service = module.get<GoogleOAuthService>(GoogleOAuthService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  it('rejects callback if state does not match cookie state', async () => {
    await expect(
      service.handleCallback('any-code', 'state-a', 'state-b', {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects if user email is not registered in database', async () => {
    jest.spyOn(service as any, 'verifyGoogleCode').mockResolvedValue({
      email: 'unregistered@tridhata.com',
      emailVerified: true,
      sub: 'google-sub-123',
    });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      service.handleCallback('valid-code', 'matched-state', 'matched-state', {}),
    ).rejects.toThrow(UnauthorizedException);

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.google_login_failed',
      }),
    );
  });

  it('allows single-use ticket exchange and rejects reuse', async () => {
    const ticket = (service as any).createExchangeTicket({
      accessToken: 'access-token',
      user: { id: 'u1', email: 'test@tridhata.com' } as any,
    });

    const result = service.exchangeTicket(ticket);
    expect(result.accessToken).toBe('access-token');

    expect(() => service.exchangeTicket(ticket)).toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest --runInBand src/modules/auth/google-oauth.service.spec.ts`
Expected: FAIL because `GoogleOAuthService` does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement `GoogleOAuthService`:
- Initialize `OAuth2Client` with `process.env.GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL`.
- Generate cryptographic random state for CSRF.
- Validate matching state.
- Exchange code with Google, extract payload (`email`, `email_verified`, `sub`).
- Check user in DB: if not found, audit and throw `UnauthorizedException({ code: 'UNREGISTERED_ACCOUNT', message: '...' })`.
- If user inactive, audit and throw `UnauthorizedException({ code: 'ACCOUNT_INACTIVE', message: '...' })`.
- In transaction: reset `failedLogins`, set `lastLoginAt`, create RefreshToken.
- Store single-use ticket in memory with 60s TTL (`ticketMap.set(ticketId, { accessToken, user, expiresAt })`).
- `exchangeTicket(ticketId)`: retrieve, delete from map, verify not expired, return `{ accessToken, user }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest --runInBand src/modules/auth/google-oauth.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/google-oauth.service.ts apps/api/src/modules/auth/google-oauth.service.spec.ts apps/api/src/modules/auth/auth.module.ts
git commit -m "feat(api): implement GoogleOAuthService with state validation and ticket exchange"
```

---

### Task 4: Backend Auth Controller Endpoints for Google SSO

**Files:**
- Modify: `apps/api/src/modules/auth/auth.controller.ts`
- Test: `apps/api/src/modules/auth/auth.controller.spec.ts`

**Interfaces:**
- Consumes: `GoogleOAuthService`, `AuthService`
- Produces:
  - `GET /auth/google`: sets `oauth_state` cookie, redirects to Google Auth URL
  - `GET /auth/google/callback`: validates, sets `rt` cookie, redirects to frontend `/auth/callback?ticket=...` (or error redirect)
  - `POST /auth/google/exchange`: body `{ ticket }`, returns `{ accessToken, user }`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/modules/auth/auth.controller.spec.ts
// Test GET /auth/google redirects with state cookie
// Test GET /auth/google/callback redirects to frontend callback or error page
// Test POST /auth/google/exchange returns accessToken and user
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest --runInBand src/modules/auth/auth.controller.spec.ts`
Expected: FAIL because Google routes are not registered on `AuthController`.

- [ ] **Step 3: Write minimal implementation**

Add to `AuthController`:
```typescript
@Public()
@Get('auth/google')
async googleLogin(@Res() reply: FastifyReply) {
  const { url, state } = this.googleOAuthService.getAuthorizationUrl();
  reply.setCookie('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/auth',
    maxAge: 600,
  });
  return reply.redirect(url);
}

@Public()
@Get('auth/google/callback')
async googleCallback(
  @Req() req: FastifyRequest,
  @RequestContext() ctx: ReqCtx,
  @Res() reply: FastifyReply,
) {
  // Extract code & state from query
  // Validate with GoogleOAuthService
  // On error: redirect to `${frontendUrl}/login?error=${code}&email=${email}`
  // On success: setRefreshTokenCookie, redirect to `${frontendUrl}/auth/callback?ticket=${ticket}`
}

@Public()
@Post('auth/google/exchange')
@HttpCode(HttpStatus.OK)
async googleExchange(
  @Body(new ZodValidationPipe(googleExchangeSchema)) dto: GoogleExchangeDto,
) {
  return this.googleOAuthService.exchangeTicket(dto.ticket);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest --runInBand src/modules/auth/auth.controller.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/auth.controller.ts apps/api/src/modules/auth/auth.controller.spec.ts
git commit -m "feat(api): add Google OAuth routes to AuthController"
```

---

### Task 5: Frontend Auth Callback Page & Context Integration

**Files:**
- Create: `apps/web/src/features/auth/AuthCallbackPage.tsx`
- Modify: `apps/web/src/features/auth/AuthContext.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/features/auth/AuthCallbackPage.spec.tsx`

**Interfaces:**
- Consumes: `/auth/google/exchange` API endpoint
- Produces: Smooth transition to authenticated app state, routes to `/auth/callback`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/features/auth/AuthCallbackPage.spec.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthCallbackPage } from './AuthCallbackPage';

describe('AuthCallbackPage', () => {
  it('shows loading indicator and exchanges ticket', async () => {
    // Render AuthCallbackPage with ?ticket=valid-ticket
    // Expect "Menghubungkan akun Google..." text
    // Expect navigate to destination on success
  });

  it('redirects to login with error if ticket is missing', async () => {
    // Render AuthCallbackPage without ticket
    // Expect redirect to /login?error=AUTH_FAILED
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test src/features/auth/AuthCallbackPage.spec.tsx`
Expected: FAIL because `AuthCallbackPage` does not exist.

- [ ] **Step 3: Write minimal implementation**

1. In `AuthContext.tsx`, add:
```typescript
loginWithTicket: (ticket: string) => Promise<void>;
```
Which calls `api<{ accessToken: string; user: AuthUser }>('/auth/google/exchange', { method: 'POST', body: JSON.stringify({ ticket }) })` and updates token & user.
2. Implement `AuthCallbackPage.tsx` with centered spinner, brand logo, and clear progress message.
3. Add route `<Route path="/auth/callback" element={<AuthCallbackPage />} />` in `App.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test src/features/auth/AuthCallbackPage.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/auth/AuthCallbackPage.tsx apps/web/src/features/auth/AuthCallbackPage.spec.tsx apps/web/src/features/auth/AuthContext.tsx apps/web/src/App.tsx
git commit -m "feat(web): add AuthCallbackPage and loginWithTicket to AuthContext"
```

---

### Task 6: Frontend Login Page Google SSO Button & Error Alerts

**Files:**
- Modify: `apps/web/src/features/auth/LoginPage.tsx`
- Test: `apps/web/src/features/auth/LoginPage.spec.tsx`

**Interfaces:**
- Consumes: Google Auth initiation URL, URL search param error codes
- Produces: Google Sign-in button with brand aesthetic, error banner mapping for Google auth errors

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/features/auth/LoginPage.spec.tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';

describe('LoginPage Google SSO', () => {
  it('renders Google SSO button', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /masuk dengan google/i })).toBeInTheDocument();
  });

  it('displays error banner when URL has UNREGISTERED_ACCOUNT error', () => {
    render(
      <MemoryRouter initialEntries={['/login?error=UNREGISTERED_ACCOUNT&email=john@example.com']}>
        <LoginPage />
      </MemoryRouter>
    );
    expect(
      screen.getByText(/akun google \(john@example.com\) belum terdaftar/i),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test src/features/auth/LoginPage.spec.tsx`
Expected: FAIL because button and error handler do not exist.

- [ ] **Step 3: Write minimal implementation**

In `LoginPage.tsx`:
1. Check `useSearchParams()` for `error` and `email`:
   - `UNREGISTERED_ACCOUNT`: "Akun Google ({email}) belum terdaftar dalam sistem Tridhata. Silakan hubungi Administrator untuk mendapatkan akses."
   - `ACCOUNT_INACTIVE`: "Akun Tridhata Anda sedang dinonaktifkan. Silakan hubungi Administrator."
   - `STATE_MISMATCH`: "Sesi login Google telah kedaluwarsa atau tidak valid. Silakan coba kembali."
   - `GOOGLE_AUTH_CANCELLED`: "Proses masuk dengan Google dibatalkan."
2. Add a clean divider:
   `<div className="relative my-5"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#e5e7eb]" /></div><div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-[#9ca3af]">atau</span></div></div>`
3. Add the "Masuk dengan Google" button:
   White background, border `#e5e7eb`, hover background `#f9fafb`, official Google multicolor "G" SVG icon, styled with the Tridhata design system.
   On click, initiates Google auth (either opens popup or navigates to `/auth/google` on API).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test src/features/auth/LoginPage.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/auth/LoginPage.tsx apps/web/src/features/auth/LoginPage.spec.tsx
git commit -m "feat(web): add Google SSO button and error messages on LoginPage"
```

---

### Task 7: Complete Workspace Verification & Setup Guide

**Files:**
- Modify: `docs/INFRA_ARCHITECTURE.md` or `README.md`
- Test: All workspace test suites (`pnpm -r test`)

- [ ] **Step 1: Run all tests in repository**

Run: `pnpm -r test` (or `pnpm --filter web test` and `pnpm --filter api test --runInBand`)
Expected: All suites PASS.

- [ ] **Step 2: Commit all final changes**

```bash
git commit -m "docs: document Google SSO setup and configuration steps"
```

