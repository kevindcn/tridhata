import './config/env'; // Wajib paling awal agar .env termuat sebelum modul lain di-require
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { validateEnv } from './config/env';

async function bootstrap() {
  const env = validateEnv();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));

  await app.register(helmet, {
    contentSecurityPolicy: false, // CSP ditangani oleh Nginx pada frontend
  });

  await app.register(fastifyCookie);

  app.enableCors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  });

  app.enableShutdownHooks();

  await app.listen(env.PORT, '0.0.0.0');
  const url = await app.getUrl();
  console.info(`Server berjalan di: ${url}`);
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
