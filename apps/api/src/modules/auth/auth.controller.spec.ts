import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ReqCtx } from '@tridhata/shared';

describe('AuthController Google SSO Endpoints', () => {
  let controller: AuthController;
  let googleOAuthService: GoogleOAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            refresh: jest.fn(),
            logout: jest.fn(),
            changePassword: jest.fn(),
            getMe: jest.fn(),
            validateCsrfOrigin: jest.fn(),
          },
        },
        {
          provide: GoogleOAuthService,
          useValue: {
            getAuthorizationUrl: jest.fn().mockReturnValue({
              url: 'https://accounts.google.com/o/oauth2/v2/auth?test=1',
              state: 'csrf-state-123456789012345678901234',
            }),
            handleCallback: jest.fn().mockResolvedValue({
              ticket: 'ticket-uuid-1',
              rawRefreshToken: 'refresh-token-raw',
              user: { id: 'u1', email: 'test@tridhata.com' },
            }),
            exchangeTicket: jest.fn().mockReturnValue({
              accessToken: 'access-jwt-token',
              user: { id: 'u1', email: 'test@tridhata.com' },
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    googleOAuthService = module.get<GoogleOAuthService>(GoogleOAuthService);
  });

  describe('GET /auth/google', () => {
    it('sets oauth_state cookie and redirects to Google consent URL', async () => {
      const replyMock = {
        setCookie: jest.fn().mockReturnThis(),
        redirect: jest.fn().mockReturnThis(),
      } as unknown as FastifyReply;

      await controller.googleLogin(replyMock);

      expect(googleOAuthService.getAuthorizationUrl).toHaveBeenCalled();
      expect(replyMock.setCookie).toHaveBeenCalledWith(
        'oauth_state',
        'csrf-state-123456789012345678901234',
        expect.objectContaining({ httpOnly: true, path: '/auth' }),
      );
      expect(replyMock.redirect).toHaveBeenCalledWith(
        'https://accounts.google.com/o/oauth2/v2/auth?test=1',
      );
    });
  });

  describe('GET /auth/google/callback', () => {
    it('redirects to /auth/callback with ticket on success', async () => {
      const reqMock = {
        query: { code: 'google-code-123', state: 'state-123' },
        cookies: { oauth_state: 'state-123' },
      } as unknown as FastifyRequest;

      const replyMock = {
        setCookie: jest.fn().mockReturnThis(),
        clearCookie: jest.fn().mockReturnThis(),
        redirect: jest.fn().mockReturnThis(),
      } as unknown as FastifyReply;

      const ctx: ReqCtx = { ip: '127.0.0.1' };

      await controller.googleCallback(reqMock, ctx, replyMock);

      expect(googleOAuthService.handleCallback).toHaveBeenCalledWith(
        'google-code-123',
        'state-123',
        'state-123',
        ctx,
      );
      expect(replyMock.clearCookie).toHaveBeenCalledWith('oauth_state', { path: '/auth' });
      expect(replyMock.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/auth/callback?ticket=ticket-uuid-1'),
      );
    });

    it('redirects to login with error code when handleCallback throws', async () => {
      const reqMock = {
        query: { code: 'code-123', state: 'state-123' },
        cookies: { oauth_state: 'state-123' },
      } as unknown as FastifyRequest;

      const replyMock = {
        clearCookie: jest.fn().mockReturnThis(),
        redirect: jest.fn().mockReturnThis(),
      } as unknown as FastifyReply;

      (googleOAuthService.handleCallback as jest.Mock).mockRejectedValueOnce({
        response: { code: 'UNREGISTERED_ACCOUNT', details: { email: 'unknown@tridhata.com' } },
      });

      await controller.googleCallback(reqMock, {}, replyMock);

      expect(replyMock.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/login?error=UNREGISTERED_ACCOUNT&email=unknown%40tridhata.com'),
      );
    });
  });

  describe('POST /auth/google/exchange', () => {
    it('exchanges ticket for access token and user', async () => {
      const result = await controller.googleExchange({ ticket: 'valid-ticket-uuid' });
      expect(googleOAuthService.exchangeTicket).toHaveBeenCalledWith('valid-ticket-uuid');
      expect(result.accessToken).toBe('access-jwt-token');
    });
  });
});
