import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../client';
import { AuthRequest } from '../middleware/auth';
import ApiError from '../utils/ApiError';
import asyncHandler from '../utils/asyncHandler';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production mode!');
}
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-123';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, fullName } = req.body;

  if (!email || !password || !fullName) {
    throw new ApiError(400, 'BAD_REQUEST', 'All fields are required');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ApiError(400, 'EMAIL_ALREADY_REGISTERED', 'Email already registered');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      hashedPassword,
      fullName,
    },
  });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

  return res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      credits: user.credits,
    },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'BAD_REQUEST', 'Email and password are required');
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new ApiError(400, 'INVALID_CREDENTIALS', 'Invalid credentials');
  }

  const isMatch = await bcrypt.compare(password, user.hashedPassword);
  if (!isMatch) {
    throw new ApiError(400, 'INVALID_CREDENTIALS', 'Invalid credentials');
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      credits: user.credits,
    },
  });
});

export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      credits: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  return res.json(user);
});
