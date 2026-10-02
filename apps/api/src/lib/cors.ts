import { FastifyCorsOptions } from '@fastify/cors';

export function getCorsOptions(
  frontendUrl?: string,
  additionalOrigins: string[] = []
): FastifyCorsOptions {
  const allowedOrigins = [
    'http://localhost:3000',
    'https://www.authhub.co',
    'https://authhub.co',
    frontendUrl,
    ...additionalOrigins,
  ]
    .filter((origin): origin is string => Boolean(origin))
    .filter((origin, index, self) => self.indexOf(origin) === index);

  return {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-agency-id', 'X-Agency-Id'],
    exposedHeaders: ['x-cache', 'x-response-time', 'x-cache-hit-rate', 'server-timing'],
  };
}
