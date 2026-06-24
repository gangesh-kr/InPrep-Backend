import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../client';
// @ts-ignore
import pdfParse from 'pdf-parse';

const SKILLS_CATALOG = [
  'React', 'Vue', 'Angular', 'Svelte', 'NextJS', 'Vite', 'TypeScript', 'JavaScript', 
  'NodeJS', 'Express', 'FastAPI', 'Python', 'Flask', 'Django', 'SQL', 'PostgreSQL', 
  'SQLite', 'MongoDB', 'Redis', 'Prisma', 'Sequelize', 'Docker', 'Kubernetes', 
  'AWS', 'GCP', 'Azure', 'Git', 'GitHub', 'CI/CD', 'Jenkins', 'HTML', 'CSS', 
  'TailwindCSS', 'SASS', 'GraphQL', 'Rest API', 'Java', 'SpringBoot', 'C++', 
  'Go', 'Golang', 'Rust', 'PHP', 'Laravel', 'NestJS', 'Ruby', 'Rails'
];

export const uploadAndParseResume = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are supported' });
    }

    const dataBuffer = req.file.buffer;
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text || '';

    const detectedSkills: string[] = [];
    SKILLS_CATALOG.forEach(skill => {
      const escapedSkill = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedSkill}\\b`, 'i');
      if (regex.test(text)) {
        detectedSkills.push(skill);
      }
    });

    if (detectedSkills.length === 0) {
      return res.json({
        message: 'No matching skills from our catalog were detected in the resume.',
        skills: []
      });
    }

    // Clear existing skills for the user to replace them with the new resume skills
    await prisma.skill.deleteMany({
      where: { userId }
    });

    const savedSkills = await Promise.all(
      detectedSkills.map(async (skillName) => {
        return prisma.skill.create({
          data: {
            userId,
            name: skillName,
            proficiencyLevel: 'Intermediate',
          },
        });
      })
    );

    return res.json({
      message: `Successfully parsed resume and processed ${savedSkills.length} skills.`,
      skills: savedSkills
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error during resume parsing' });
  }
};
