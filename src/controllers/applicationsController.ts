import { Response } from 'express';
import prisma from '../client';
import { AuthRequest } from '../middleware/auth';
import ApiError from '../utils/ApiError';
import asyncHandler from '../utils/asyncHandler';

export const listApplications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status } = req.query;

  const whereClause: any = {
    userId: req.userId,
  };

  if (status) {
    whereClause.status = status as string;
  }

  const apps = await prisma.application.findMany({
    where: whereClause,
    include: {
      company: true,
      rounds: {
        orderBy: {
          roundNumber: 'asc',
        },
      },
    },
    orderBy: {
      appliedDate: 'desc',
    },
  });

  return res.json(apps);
});

export const createApplication = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { companyName, companyWebsite, position, salaryMin, salaryMax, currency, source, status, appliedDate } = req.body;

  if (!companyName || !position || !appliedDate) {
    throw new ApiError(400, 'BAD_REQUEST', 'Company Name, Position, and Applied Date are required');
  }

  // Find or create company
  let company = await prisma.company.findUnique({
    where: { name: companyName },
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: companyName,
        website: companyWebsite || null,
      },
    });
  }

  const application = await prisma.application.create({
    data: {
      userId: req.userId!,
      companyId: company.id,
      position,
      salaryMin: salaryMin ? parseInt(salaryMin) : null,
      salaryMax: salaryMax ? parseInt(salaryMax) : null,
      currency: currency || 'USD',
      source: source || null,
      status: status || 'Applied',
      appliedDate: new Date(appliedDate),
    },
    include: {
      company: true,
    },
  });

  return res.status(201).json(application);
});

export const getApplication = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const application = await prisma.application.findFirst({
    where: {
      id,
      userId: req.userId,
    },
    include: {
      company: true,
      rounds: {
        include: {
          questions: {
            include: {
              skills: true,
            },
          },
        },
        orderBy: {
          roundNumber: 'asc',
        },
      },
    },
  });

  if (!application) {
    throw new ApiError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
  }

  return res.json(application);
});

export const updateApplication = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { position, salaryMin, salaryMax, currency, source, status, appliedDate } = req.body;

  // Verify ownership
  const existing = await prisma.application.findFirst({
    where: {
      id,
      userId: req.userId,
    },
  });

  if (!existing) {
    throw new ApiError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
  }

  const updated = await prisma.application.update({
    where: { id },
    data: {
      position: position !== undefined ? position : existing.position,
      salaryMin: salaryMin !== undefined ? (salaryMin ? parseInt(salaryMin) : null) : existing.salaryMin,
      salaryMax: salaryMax !== undefined ? (salaryMax ? parseInt(salaryMax) : null) : existing.salaryMax,
      currency: currency !== undefined ? currency : existing.currency,
      source: source !== undefined ? source : existing.source,
      status: status !== undefined ? status : existing.status,
      appliedDate: appliedDate !== undefined ? new Date(appliedDate) : existing.appliedDate,
    },
    include: {
      company: true,
    },
  });

  return res.json(updated);
});

export const deleteApplication = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  // Verify ownership
  const existing = await prisma.application.findFirst({
    where: {
      id,
      userId: req.userId,
    },
  });

  if (!existing) {
    throw new ApiError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
  }

  await prisma.application.delete({
    where: { id },
  });

  return res.json({ message: 'Application deleted successfully' });
});
