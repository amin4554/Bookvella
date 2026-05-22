import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // Eagerly open the connection pool so the first request and health checks
    // don't pay the connection-establishment cost.
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
