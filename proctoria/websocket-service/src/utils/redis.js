const { createClient } = require('redis');
const logger = require('../utils/logger');

class RedisClient {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  async connect() {
    try {
      const redisUrl = `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 500)
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
        this.connected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
        this.connected = true;
      });

      await this.client.connect();
      logger.info('Redis client initialized');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.connected = false;
    }
  }

  isConnected() {
    return this.connected && this.client && this.client.isOpen;
  }

  async get(key) {
    if (!this.isConnected()) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Redis GET error:', error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    if (!this.isConnected()) return false;
    try {
      await this.client.setEx(key, ttl, value);
      return true;
    } catch (error) {
      logger.error('Redis SET error:', error);
      return false;
    }
  }

  async setex(key, ttl, value) {
    return await this.set(key, value, ttl);
  }

  async del(key) {
    if (!this.isConnected()) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis DEL error:', error);
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.connected = false;
    }
  }
}

// Export singleton instance
const redisClient = new RedisClient();
module.exports = redisClient;