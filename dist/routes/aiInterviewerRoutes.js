"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const aiInterviewerController_1 = require("../controllers/aiInterviewerController");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.post('/start', upload.single('resume'), aiInterviewerController_1.startInterview);
router.post('/respond', aiInterviewerController_1.respondInterview);
router.post('/finish', aiInterviewerController_1.finishInterview);
router.get('/history', aiInterviewerController_1.getHistory);
router.get('/history/:id', aiInterviewerController_1.getInterviewDetails);
exports.default = router;
