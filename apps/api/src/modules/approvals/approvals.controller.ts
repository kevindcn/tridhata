import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestContext } from '../../common/decorators/req-ctx.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  AuthUser,
  CreateRequestDto,
  createRequestSchema,
  DecideRequestDto,
  decideRequestSchema,
  ReqCtx,
} from '@tridhata/shared';
import { RequestStatus } from '@prisma/client';

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @RequirePermissions('approval:create')
  @Post()
  async create(
    @Body(new ZodValidationPipe(createRequestSchema)) dto: CreateRequestDto,
    @CurrentUser() user: AuthUser,
    @RequestContext() ctx: ReqCtx,
  ) {
    return this.approvalsService.createRequest(user, dto, ctx);
  }

  @RequirePermissions('approval:create')
  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('locationId') locationId?: string,
    @Query('status') status?: RequestStatus,
    @Query('type') type?: string,
  ) {
    return this.approvalsService.getRequests(user, {
      locationId,
      status,
      type,
    });
  }

  @RequirePermissions('approval:create')
  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.approvalsService.getRequestById(user, id);
  }

  @RequirePermissions('approval:decide')
  @Post(':id/decide')
  @HttpCode(HttpStatus.OK)
  async decide(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(decideRequestSchema)) dto: DecideRequestDto,
    @CurrentUser() user: AuthUser,
    @RequestContext() ctx: ReqCtx,
  ) {
    return this.approvalsService.decide(user, id, dto, ctx);
  }
}
