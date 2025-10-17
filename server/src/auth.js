const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

function signToken(user) {
    return jwt.sign(
        {sub: user.id, email: user.email, name: user.name, role: user.role },
        JWT_SECRET,
        {expiresIn: JWT_EXPIRES}
    );
}

function authRequired(req, res, next) {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({error: 'Missing token'});
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    }
    catch(e) {
        return res.status(401).json({error: 'Invalid / expired token'});
    }
    }

function roleRequired(...allowed) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({error: 'Not allowed by roles'});
        if (!allowed.includes(req.user.role)) {
            return res.status(403).json({error: 'Not Allowed'});
        } next();
    };
}

async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

async function comparePassword(plain, hash){
    return bcrypt.compare(plain, hash);
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}


module.exports = {
    signToken, authRequired, roleRequired, hashPassword, comparePassword, verifyToken
};