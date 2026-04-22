const redis = require('redis');
//const logger = require('../utils/logger')

module.exports = class KVStore {
    constructor(logger) {
        this.logger = logger
        this.client = redis.createClient();
         this.client.on('error', (err) => console.log('Redis Client Error', err));
//        this.client.on('error', (err) => logger.log.info('Redis Client Error', err));
         this.client.on('connect', () => console.log('Redis client connected.'));
//        this.client.on('connect', () => logger.log.info('Redis client connected.'));
        this.client.connect();
    }
    
    async set(key, value) { 
        let res = await this.client.set(key, value);
        return res;
    }

    async get(key) {
        const value = await this.client.get(key);
        return value;
    }

    async getDel(key) {
        const value = await this.client.getDel(key);
        return value;
    }

}
