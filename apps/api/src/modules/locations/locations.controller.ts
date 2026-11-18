import { Controller, Get } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '@tridhata/shared';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  async getLocations(@CurrentUser() user: AuthUser) {
    return this.locationsService.getAccessibleLocations(user);
  }
}
