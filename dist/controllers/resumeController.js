"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadAndParseResume = void 0;
const client_1 = __importDefault(require("../client"));
// @ts-ignore
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const SKILLS_CATALOG = [
    'React', 'Vue', 'Angular', 'Svelte', 'NextJS', 'Vite', 'TypeScript', 'JavaScript',
    'NodeJS', 'Express', 'FastAPI', 'Python', 'Flask', 'Django', 'SQL', 'PostgreSQL',
    'SQLite', 'MongoDB', 'Redis', 'Prisma', 'Sequelize', 'Docker', 'Kubernetes',
    'AWS', 'GCP', 'Azure', 'Git', 'GitHub', 'CI/CD', 'Jenkins', 'HTML', 'CSS',
    'TailwindCSS', 'SASS', 'GraphQL', 'Rest API', 'Java', 'SpringBoot', 'C++',
    'Go', 'Golang', 'Rust', 'PHP', 'Laravel', 'NestJS', 'Ruby', 'Rails'
];
const uploadAndParseResume = async (req, res) => {
    try {
        const userId = req.userId;
        if (!req.file) {
            return res.status(400).json({ error: 'Please upload a PDF file' });
        }
        if (req.file.mimetype !== 'application/pdf') {
            return res.status(400).json({ error: 'Only PDF files are supported' });
        }
        const dataBuffer = req.file.buffer;
        const pdfData = await (0, pdf_parse_1.default)(dataBuffer);
        const text = pdfData.text || '';
        const detectedSkills = [];
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
        await client_1.default.skill.deleteMany({
            where: { userId }
        });
        const savedSkills = await Promise.all(detectedSkills.map(async (skillName) => {
            return client_1.default.skill.create({
                data: {
                    userId,
                    name: skillName,
                    proficiencyLevel: 'Intermediate',
                },
            });
        }));
        return res.json({
            message: `Successfully parsed resume and processed ${savedSkills.length} skills.`,
            skills: savedSkills
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error during resume parsing' });
    }
};
exports.uploadAndParseResume = uploadAndParseResume;
