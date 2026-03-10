const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const connectDB = async () => {
    try {
        // Automatically start in-memory MongoDB
        console.log('Starting In-Memory MongoDB (No local installation required)...');
        const mongod = await MongoMemoryServer.create();
        const mongoUri = mongod.getUri();
        console.log(`In-Memory MongoDB URL: ${mongoUri}`);

        const conn = await mongoose.connect(mongoUri);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
