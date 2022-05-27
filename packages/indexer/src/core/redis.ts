import { createClient } from 'redis';
import { RedisClient } from './types';

export function getRedis(): RedisClient {
  return createClient({
    url: process.env.REDIS_URL || 'redis://redis:6379',
  });
}
