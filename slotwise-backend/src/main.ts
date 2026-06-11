import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/http-exception.filter';

function isAllowedCorsOrigin(origin: string, allowedOrigins: string[]) {
  if (allowedOrigins.includes(origin)) return true;

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  return allowedOrigins.some((allowed) => {
    try {
      const parsedAllowed = new URL(allowed);
      return (
        parsedOrigin.protocol === parsedAllowed.protocol &&
        parsedOrigin.hostname.endsWith(`.${parsedAllowed.hostname}`)
      );
    } catch {
      return false;
    }
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
    rawBody: true,
  });
  app.use(cookieParser());
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) ?? [
    'http://localhost:3002',
    'http://127.0.0.1:3002',
  ];
  const isDev = process.env.NODE_ENV !== 'production';
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (isAllowedCorsOrigin(origin, corsOrigins)) {
        callback(null, true);
        return;
      }
      if (
        isDev &&
        (
          /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin) ||
          /^https?:\/\/([a-z0-9-]+\.)*lvh\.me(:\d+)?$/i.test(origin)
        )
      ) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });

  if (process.env.SWAGGER_ENABLED !== 'false') {
    const config = new DocumentBuilder()
      .setTitle('Appointment Booking API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = Number(process.env.API_PORT) || 3003;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
  if (process.env.SWAGGER_ENABLED !== 'false') {
    console.log(`Swagger: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
