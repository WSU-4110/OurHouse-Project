const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_EXPIRES = '7d';
const {
  signToken,
  hashPassword,
  comparePassword,
  verifyToken,
  authRequired,
  roleRequired
} = require('../auth');


describe('Authentication Module Unit Tests', () => {
  
  //signtoken for test 1
  describe('signToken', () => {
    test('should generate a valid JWT token with user data', () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin'
      };

      const token = signToken(mockUser);
      expect(typeof token).toBe('string');
      
      //header.payload.signature
      expect(token.split('.').length).toBe(3);
      
      //decodes and verifies token contains correct data
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.sub).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.name).toBe(mockUser.name);
      expect(decoded.role).toBe(mockUser.role);
    });

    test('should create different tokens for different users', () => {
      const user1 = { id: 1, email: 'user1@test.com', name: 'User 1', role: 'Worker' };
      const user2 = { id: 2, email: 'user2@test.com', name: 'User 2', role: 'Manager' };

      const token1 = signToken(user1);
      const token2 = signToken(user2);

      expect(token1).not.toBe(token2);
    });
  });

  //hashpassword for test 2
  describe('hashPassword', () => {
    test('should hash a plain text password', async () => {
      const plainPassword = 'mySecurePassword123';
      const hashedPassword = await hashPassword(plainPassword);
      expect(typeof hashedPassword).toBe('string');
      //should not equal the plain password
      expect(hashedPassword).not.toBe(plainPassword);
      //should be bcrypt format (starts with $2b$)
      expect(hashedPassword).toMatch(/^\$2[aby]\$/);
    });

    test('should generate different hashes for the same password', async () => {
      const password = 'samePassword';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      //hashes should be different
      expect(hash1).not.toBe(hash2);
    });
  });

  //comparePassword (should validate passwords correctly) for test 3
  describe('comparePassword', () => {
    test('should return true for correct password', async () => {
      const plainPassword = 'correctPassword123';
      const hashedPassword = await hashPassword(plainPassword);

      const isMatch = await comparePassword(plainPassword, hashedPassword);
      
      expect(isMatch).toBe(true);
    });

    test('should return false for incorrect password', async () => {
      const correctPassword = 'correctPassword123';
      const wrongPassword = 'wrongPassword456';
      const hashedPassword = await hashPassword(correctPassword);

      const isMatch = await comparePassword(wrongPassword, hashedPassword);
      
      expect(isMatch).toBe(false);
    });

    test('should handle empty password', async () => {
      const hashedPassword = await hashPassword('somePassword');
      const isMatch = await comparePassword('', hashedPassword);
      
      expect(isMatch).toBe(false);
    });
  });

  //verifyToken (should verify JWT tokens correctly) for test 4
  describe('verifyToken', () => {
    test('should successfully verify a valid token', () => {
      const mockUser = {
        id: 5,
        email: 'verify@test.com',
        name: 'Verify User',
        role: 'Manager'
      };

      const token = signToken(mockUser);
      const decoded = verifyToken(token);

      expect(decoded.sub).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
    });

    test('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => {
        verifyToken(invalidToken);
      }).toThrow();
    });

    test('should throw error for expired token', () => {
      //creates token with immediate expiration
      const expiredToken = jwt.sign(
        { sub: 1, email: 'test@test.com' },
        process.env.JWT_SECRET,
        { expiresIn: '0s' }
      );

      //waits a moment to ensure expiration
      return new Promise(resolve => setTimeout(resolve, 100)).then(() => {
        expect(() => {
          verifyToken(expiredToken);
        }).toThrow();
      });
    });
  });

  //authRequired middleware (should validate authentication) for test 5
  describe('authRequired', () => {
    test('should call next() with valid token', () => {
      const mockUser = { id: 1, email: 'test@test.com', name: 'Test', role: 'Worker' };
      const token = signToken(mockUser);

      const req = {
        headers: {
          authorization: `Bearer ${token}`
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      authRequired(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.email).toBe(mockUser.email);
    });

    test('should return 401 when token is missing', () => {
      const req = {
        headers: {}
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      authRequired(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing token' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 when token is invalid', () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid_token_here'
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      authRequired(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid / expired token' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  //roleRequired middleware (should validate user roles) for test 6
  describe('roleRequired', () => {
    test('should allow access for authorized role', () => {
      const req = {
        user: { id: 1, role: 'Admin' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = roleRequired('Admin', 'Manager');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should deny access for unauthorized role', () => {
      const req = {
        user: { id: 1, role: 'Worker' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = roleRequired('Admin', 'Manager');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Not Allowed' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 when user is not authenticated', () => {
      const req = {}; 
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = roleRequired('Admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Not allowed by roles' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should work with single role parameter', () => {
      const req = {
        user: { id: 1, role: 'Manager' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = roleRequired('Manager');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
