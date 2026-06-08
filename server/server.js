import express from 'express';
import mongoose from 'mongoose';
import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Adjust for production later
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// MongoDB is strictly for Identity Management (Auth). Chat data never touches this database.
const mongoUri = process.env.MONGODB_URI;
if (mongoUri) {
  mongoose.connect(mongoUri)
    .then(() => console.log('Connected to MongoDB Atlas (Identity Management only)'))
    .catch((err) => console.error('MongoDB connection error:', err));
} else {
  console.log('MongoDB connection string (MONGODB_URI) is missing in environment.');
}

// Connect Node server to Upstash Redis using @upstash/redis. 
// This will act as your ephemeral message queue and public key directory.
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis;
if (redisUrl && redisToken) {
  redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });

  // Test Redis connection
  redis.ping()
    .then(() => console.log('Connected to Upstash Redis'))
    .catch((err) => console.error('Redis connection error:', err));
} else {
  console.log('Upstash Redis credentials are missing in environment.');
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Opaque API is running' });
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
