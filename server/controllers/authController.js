import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import User from '../model/User.js';

export const register = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash password with 12 rounds
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `OpaqueApp (${username})`
    });

    const user = new User({
      username,
      password: hashedPassword,
      role: role || 'User',
      totpSecret: secret.base32
    });

    await user.save();

    // Generate QR Code for Google Authenticator
    QRCode.toDataURL(secret.otpauth_url, (err, data_url) => {
      if (err) {
        return res.status(500).json({ message: 'Error generating QR code' });
      }
      res.status(201).json({
        message: 'User registered successfully',
        qrCodeUrl: data_url,
        secret: secret.base32 // For manual entry if QR code fails
      });
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

export const login = async (req, res) => {
  try {
    const { username, password, totpCode } = req.body;

    if (!username || !password || !totpCode) {
      return res.status(400).json({ message: 'Username, password, and TOTP code are required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Validate TOTP
    const isTotpValid = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: totpCode,
      window: 1 // Allow 1 step before/after to account for slight clock skew
    });

    if (!isTotpValid) {
      return res.status(401).json({ message: 'Invalid 2FA code' });
    }

    // Issue an RSA-signed JWT (15-minute expiry)
    const privateKey = process.env.JWT_PRIVATE_KEY;
    if (!privateKey) {
      console.error('JWT_PRIVATE_KEY is missing from environment');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const payload = {
      userId: user._id,
      username: user.username,
      role: user.role
    };

    // Replace literal \n with actual newlines if provided via env string
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

    const token = jwt.sign(payload, formattedPrivateKey, {
      algorithm: 'RS256',
      expiresIn: '15m'
    });

    res.json({
      message: 'Login successful',
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};
