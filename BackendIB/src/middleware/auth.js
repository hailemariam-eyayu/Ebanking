const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';

function verifyIB(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== 'IB') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function signToken(payload, expiresIn = '8h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

module.exports = { verifyIB, signToken };
