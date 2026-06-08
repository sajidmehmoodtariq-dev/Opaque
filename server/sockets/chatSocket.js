import redisClient from '../utils/redisClient.js';

export const registerChatHandlers = (io, socket) => {
  // Join a personal room based on userId to receive direct messages
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their personal socket room.`);
  });

  // Handle incoming encrypted messages
  socket.on('sendMessage', async (payload) => {
    const { targetUserId, roomId, blob } = payload;
    
    // The server is a BLIND RELAY. It does not parse the `blob`.
    // The blob contains: AES-encrypted message, IV, and the RSA-encrypted AES key.

    try {
      if (redisClient) {
        // Zero-Persistence Queue: Push to Upstash Redis with a 60-second TTL
        // Using a list to hold messages for the specific relay channel
        const queueKey = `relay:${targetUserId}:${roomId}`;
        
        // Push the blob into the queue
        await redisClient.lpush(queueKey, JSON.stringify(blob));
        // Set the TTL to 60 seconds
        await redisClient.expire(queueKey, 60);
      }

      // Emit the message immediately to User B's socket room
      io.to(targetUserId).emit('receiveMessage', {
        roomId,
        blob
      });

    } catch (error) {
      console.error('Relay error:', error);
      // Depending on strictness, we might want to alert the sender if relay failed
      socket.emit('relayError', { message: 'Failed to relay message' });
    }
  });
};
