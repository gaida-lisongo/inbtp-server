const memjs = require('memjs');
require('dotenv').config();

class CacheManager {
  constructor() {
    // Connect to Memcachier using environment variables
    this.client = memjs.Client.create(`${process.env.MEMCACHE_HOST}:${process.env.MEMCACHE_PORT}`, {
      username: process.env.MEMCACHE_USERNAME,
      password: process.env.MEMCACHE_PASSWORD,
      expires: 600, // Default expiration in seconds (10 minutes)
      failover: true,
      retries: 2
    });
    
    console.log(`Connected to Memcachier at ${process.env.MEMCACHE_HOST}:${process.env.MEMCACHE_PORT}`);
  }

  // Set a value in cache with optional expiration (in seconds)
  async set(key, value, expiration = 600) {
    try {
      const valueString = typeof value === 'object' ? JSON.stringify(value) : String(value);
      await this.client.set(key, valueString, { expires: expiration });
      return true;
    } catch (error) {
      console.error(`Error setting cache for key ${key}:`, error);
      return false;
    }
  }

  // Get a value from cache
  async get(key) {
    try {
      const { value } = await this.client.get(key);
      
      if (!value) return null;
      
      // Try parsing as JSON, fall back to string if it fails
      try {
        return JSON.parse(value.toString('utf-8'));
      } catch (e) {
        return value.toString('utf-8');
      }
    } catch (error) {
      console.error(`Error getting cache for key ${key}:`, error);
      return null;
    }
  }

  // Delete a value from cache
  async delete(key) {
    try {
      await this.client.delete(key);
      return true;
    } catch (error) {
      console.error(`Error deleting cache for key ${key}:`, error);
      return false;
    }
  }

  // Flush the entire cache
  async flush() {
    try {
      await this.client.flush();
      return true;
    } catch (error) {
      console.error('Error flushing cache:', error);
      return false;
    }
  }

  // Close the connection
  close() {
    this.client.close();
  }
}

module.exports = new CacheManager();