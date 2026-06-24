"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteApplication = exports.updateApplication = exports.getApplication = exports.createApplication = exports.listApplications = void 0;
const client_1 = __importDefault(require("../client"));
const listApplications = async (req, res) => {
    try {
        const { status } = req.query;
        const whereClause = {
            userId: req.userId,
        };
        if (status) {
            whereClause.status = status;
        }
        const apps = await client_1.default.application.findMany({
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.listApplications = listApplications;
const createApplication = async (req, res) => {
    try {
        const { companyName, companyWebsite, position, salaryMin, salaryMax, currency, source, status, appliedDate } = req.body;
        if (!companyName || !position || !appliedDate) {
            return res.status(400).json({ error: 'Company Name, Position, and Applied Date are required' });
        }
        // Find or create company
        let company = await client_1.default.company.findUnique({
            where: { name: companyName },
        });
        if (!company) {
            company = await client_1.default.company.create({
                data: {
                    name: companyName,
                    website: companyWebsite || null,
                },
            });
        }
        const application = await client_1.default.application.create({
            data: {
                userId: req.userId,
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.createApplication = createApplication;
const getApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const application = await client_1.default.application.findFirst({
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.getApplication = getApplication;
const updateApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const { position, salaryMin, salaryMax, currency, source, status, appliedDate } = req.body;
        // Verify ownership
        const existing = await client_1.default.application.findFirst({
            where: {
                id,
                userId: req.userId,
            },
        });
        if (!existing) {
            return res.status(404).json({ error: 'Application not found' });
        }
        const updated = await client_1.default.application.update({
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.updateApplication = updateApplication;
const deleteApplication = async (req, res) => {
    try {
        const { id } = req.params;
        // Verify ownership
        const existing = await client_1.default.application.findFirst({
            where: {
                id,
                userId: req.userId,
            },
        });
        if (!existing) {
            return res.status(404).json({ error: 'Application not found' });
        }
        await client_1.default.application.delete({
            where: { id },
        });
        return res.json({ message: 'Application deleted successfully' });
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.deleteApplication = deleteApplication;
