import { SetMetadata } from '@nestjs/common';
import { Permission } from '@tridhata/shared';

export const PERMS_KEY = 'permissions';
export const RequirePermissions = (...p: Permission[]) => SetMetadata(PERMS_KEY, p);
