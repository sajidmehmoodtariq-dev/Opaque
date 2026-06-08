import redisClient from '../utils/redisClient.js';

export const uploadPublicKey = async (req, res) => {
  try {
    const { publicKey } = req.body;
    const userId = req.user.userId;

    if (!publicKey) {
      return res.status(400).json({ message: 'Public key is required' });
    }

    if (!redisClient) {
      return res.status(500).json({ message: 'Redis client is not configured' });
    }

    // Store public key in Redis against the userId with a 24-hour TTL (86400 seconds)
    await redisClient.set(`public_key:${userId}`, publicKey, { ex: 86400 });

    res.status(200).json({ message: 'Public key uploaded successfully' });
  } catch (error) {
    console.error('Error uploading public key:', error);
    res.status(500).json({ message: 'Server error while uploading public key' });
  }
};

export const getPublicKey = async (req, res) => {
  try {
    const { targetUserId } = req.params;

    if (!redisClient) {
      return res.status(500).json({ message: 'Redis client is not configured' });
    }

    const publicKey = await redisClient.get(`public_key:${targetUserId}`);

    if (!publicKey) {
      return res.status(404).json({ message: 'Public key not found or expired' });
    }

    res.status(200).json({ publicKey });
  } catch (error) {
    console.error('Error fetching public key:', error);
    res.status(500).json({ message: 'Server error while fetching public key' });
  }
};
