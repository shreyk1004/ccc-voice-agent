import { Router, Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters')
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

// Simple in-memory user store (replace with database later)
interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  createdAt: Date;
}

const users: User[] = [];

// Helper function to generate JWT
const generateToken = (user: Omit<User, 'password'>): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' } as SignOptions
  );
};

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = users.find(u => u.email === validatedData.email);
    if (existingUser) {
      res.status(400).json({ error: 'User with this email already exists' });
      return;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);
    
    // Create new user
    const newUser: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: validatedData.email,
      password: hashedPassword,
      name: validatedData.name,
      createdAt: new Date()
    };
    
    users.push(newUser);
    
    // Generate token
    const token = generateToken({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      createdAt: newUser.createdAt
    });
    
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
      return;
    }
    
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);
    
    // Find user
    const user = users.find(u => u.email === validatedData.email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    
    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    });
    
    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
      return;
    }
    
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

export { router as authRoutes }; 