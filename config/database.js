const mongoose = require('mongoose');
require('dotenv').config();

class Database {
    constructor() {
        this.maxRetries = 5;
        this.retryDelay = 5000; // 5 seconds
        this.currentRetry = 0;
        this._connect();
    }

    async _connect() {
        const uri = process.env.MONGO_DB_URI;

        if (!uri) {
            console.error('Fatal: MongoDB URI is not defined in environment variables');
            process.exit(1);
        }

        try {
            await mongoose.connect(uri, {
                serverSelectionTimeoutMS: 5000,
                heartbeatFrequencyMS: 2000,
                retryWrites: true,
                maxPoolSize: 10,
                minPoolSize: 2
            });

            console.log('✅ Database connection successful');

            // Handle connection errors after initial connection
            mongoose.connection.on('error', (err) => {
                console.error('MongoDB connection error:', err);
                this._handleConnectionError();
            });

            mongoose.connection.on('disconnected', () => {
                console.log('MongoDB disconnected, attempting to reconnect...');
                this._handleConnectionError();
            });

            // Reset retry counter on successful connection
            this.currentRetry = 0;

        } catch (err) {
            console.error('Failed to connect to MongoDB:', err);
            this._handleConnectionError();
        }
    }

    _handleConnectionError() {
        if (this.currentRetry < this.maxRetries) {
            this.currentRetry++;
            console.log(`Retrying connection... Attempt ${this.currentRetry}/${this.maxRetries}`);
            setTimeout(() => {
                this._connect();
            }, this.retryDelay);
        } else {
            console.error('Max retry attempts reached. Exiting process...');
            process.exit(1);
        }
    }
}

// Create and export a single instance
const database = new Database();
module.exports = database;