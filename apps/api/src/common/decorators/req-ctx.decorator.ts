import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { ReqCtx } from '@tridhata/shared';

export const RequestContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ReqCtx => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    return {
      ip: request.ip || (request.headers['x-forwarded-for'] as string) || undefined,
      userAgent: request.headers['user-agent'] || undefined,
    };
  },
);
