const memjs = require('memjs');
require('dotenv').config();

// Parse port as integer and provide fallback
const port = parseInt(process.env.MEMCACHE_PORT) || 11211;

const client = memjs.Client.create(`${process.env.MEMCACHE_HOST}:${port}`, {
    username: process.env.MEMCACHE_USERNAME,
    password: process.env.MEMCACHE_PASSWORD,
    timeout: 1,
    retries: 2
});

const cache = {
    async get(key) {
        try {
            const { value } = await client.get(key);
            return value ? JSON.parse(value.toString()) : null;
        } catch (error) {
            console.error('Cache get error:', error);
            return null; // Fallback to no cache on error
        }
    },

    async set(key, value, expires = 3600) {
        try {
            await client.set(key, JSON.stringify(value), { expires });
            return true;
        } catch (error) {
            console.error('Cache set error:', error);
            return false; // Indicate cache set failed
        }
    },

    async delete(key) {
        try {
            await client.delete(key);
            return true;
        } catch (error) {
            console.error('Cache delete error:', error);
            return false;
        }
    }
};

module.exports = cache;