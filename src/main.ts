import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfiguration } from './swagger.template.config';


async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors();

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  // Swagger config
  const swaggerConfig = swaggerConfiguration;
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    swaggerOptions: { persistAuthorization: true },
  });

  // App listening.
  await app.listen(port);

  // Swagger ready
  console.log(`Swagger UI available at http://localhost:${port}/api/docs`);

  // eslint-disable-next-line no-console
  console.log(`Unified Document Viewer listening on http://localhost:${port}`);
}

bootstrap();
