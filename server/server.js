import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import redisClient from './utils/redisClient.js';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/authRoutes.js';
import keyRoutes from './routes/keyRoutes.js';
import { registerChatHandlers } from './sockets/chatSocket.js';

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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/keys', keyRoutes);

// MongoDB is strictly for Identity Management (Auth). Chat data never touches this database.
const mongoUri = process.env.MONGODB_URI;
if (mongoUri) {
  mongoose.connect(mongoUri)
    .then(() => console.log('Connected to MongoDB Atlas (Identity Management only)'))
    .catch((err) => console.error('MongoDB connection error:', err));
} else {
  console.log('MongoDB connection string (MONGODB_URI) is missing in environment.');
}

if (redisClient) {
  redisClient.ping()
    .then(() => console.log('Connected to Upstash Redis'))
    .catch((err) => console.error('Redis connection error:', err));
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Opaque API is running' });
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Register the real-time chat relay handlers
  registerChatHandlers(io, socket);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
