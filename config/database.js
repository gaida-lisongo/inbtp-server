const mongoose = require('mongoose');
require('dotenv').config();

class Database {
    constructor() {
        if (Database.instance) {
            return Database.instance;
        }
        Database.instance = this;
        return this._connect();
    }

    async _connect() {
        try {
            const connection = await mongoose.connect(process.env.MONGO_DB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('MongoDB connected successfully');
            return connection;
        } catch (err) {
            console.error('MongoDB connection error:', err);
            throw err;
        }
    }
}

// Export l'instance de connexion
module.exports = new Database();