import { Response } from 'express';
import prisma from '../client';
import { AuthRequest } from '../middleware/auth';

export const listApplications = async (req: AuthRequest, res: Response) => {
  try {
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const createApplication = async (req: AuthRequest, res: Response) => {
  try {
    const { companyName, companyWebsite, position, salaryMin, salaryMax, currency, source, status, appliedDate } = req.body;

    if (!companyName || !position || !appliedDate) {
      return res.status(400).json({ error: 'Company Name, Position, and Applied Date are required' });
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getApplication = async (req: AuthRequest, res: Response) => {
  try {
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
      return res.status(404).json({ error: 'Application not found' });
    }

    return res.json(application);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const updateApplication = async (req: AuthRequest, res: Response) => {
  try {
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
      return res.status(404).json({ error: 'Application not found' });
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const deleteApplication = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.application.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Application not found' });
    }

    await prisma.application.delete({
      where: { id },
    });

    return res.json({ message: 'Application deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
