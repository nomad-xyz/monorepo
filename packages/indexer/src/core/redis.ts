import { createClient } from 'redis';
import { RedisClient } from './types';
import { redisUrl } from '../config';

export function getRedis(): RedisClient {
  return createClient({
    url: redisUrl,
  });
}
