import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  AuthUser,
  CreateUserDto,
  createUserSchema,
  ReqCtx,
  UpdateUserDto,
  updateUserSchema,
} from '@tridhata/shared';
import { UsersService } from './users.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestContext } from '../../common/decorators/req-ctx.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('users')
@RequirePermissions('user:manage')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getUsers() {
    return this.usersService.getUsers();
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserDto,
    @CurrentUser() user: AuthUser,
    @RequestContext() ctx: ReqCtx,
  ) {
    return this.usersService.createUser(dto, ctx, user.id);
  }

  @Patch(':id')
  async updateUser(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
    @RequestContext() ctx: ReqCtx,
  ) {
    return this.usersService.updateUser(id, dto, ctx, user);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @RequestContext() ctx: ReqCtx,
  ) {
    return this.usersService.resetPassword(id, ctx, user.id);
  }
}
