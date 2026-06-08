import jwt from 'jsonwebtoken';

// Middleware to authenticate JWT
export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    const publicKey = process.env.JWT_PUBLIC_KEY;
    if (!publicKey) {
      console.error('JWT_PUBLIC_KEY is missing from environment');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const formattedPublicKey = publicKey.replace(/\\n/g, '\n');

    jwt.verify(token, formattedPublicKey, { algorithms: ['RS256'] }, (err, user) => {
      if (err) {
        return res.status(403).json({ message: 'Token is invalid or expired' });
      }
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ message: 'Authorization header is missing or malformed' });
  }
};

// RBAC Middleware to check roles
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Access denied: No role assigned' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: `Access denied for role: ${req.user.role}` });
    }

    next();
  };
};

// Specific role checks based on Phase 2 requirements:
// Admin: view active rooms/users
// User: chat
// Guest: read public rooms
export const requireAdmin = authorizeRoles('Admin');
export const requireUser = authorizeRoles('Admin', 'User'); // Admins usually inherit User permissions
export const requireGuest = authorizeRoles('Admin', 'User', 'Guest');
