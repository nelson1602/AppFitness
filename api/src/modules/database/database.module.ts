import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Global database module. Feature modules never import PrismaClient
 * directly — their infrastructure layers inject PrismaService
 * (Repository Pattern, .ai/01_ARCHITECTURE.md).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
