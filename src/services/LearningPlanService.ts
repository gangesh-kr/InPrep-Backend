import prisma from '../client';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';
import { callGemini, isGeminiEnabled } from '../utils/gemini';

export class LearningPlanService {
  static async generatePlan({
    userId,
    targetCompanies,
    targetRole,
    availableHoursPerWeek,
    interviewDate
  }: {
    userId: string;
    targetCompanies: string[];
    targetRole: string;
    availableHoursPerWeek: number;
    interviewDate?: string | null;
  }) {
    // 1. Fetch user's weakness profile
    const weaknessProfile = await prisma.weaknessProfile.findUnique({
      where: { userId }
    });

    const weakTopics = weaknessProfile ? JSON.parse(weaknessProfile.topics as string) : [];

    // 2. Fetch session history summary
    const sessions = await prisma.aIInterview.findMany({
      where: {
        userId,
        overallScore: { not: null },
        deletedAt: null
      },
      select: {
        interviewType: true,
        overallScore: true
      }
    });

    const totalSessions = sessions.length;
    const averageScore = totalSessions > 0 
      ? Math.round(sessions.reduce((sum, s) => sum + (s.overallScore || 0), 0) / totalSessions)
      : 0;

    // 3. Determine plan timeline and urgency
    let durationWeeks = 4; // Default to 4 weeks
    let urgency = 'normal';

    if (interviewDate) {
      const daysUntilInterview = Math.max(1, Math.round((new Date(interviewDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
      durationWeeks = Math.max(1, Math.ceil(daysUntilInterview / 7));
      
      if (daysUntilInterview < 14) {
        urgency = 'urgent';
      } else if (daysUntilInterview <= 56) {
        urgency = 'normal';
      } else {
        urgency = 'relaxed';
      }
    }

    // 4. Compose prompt for Gemini
    let planData;
    if (isGeminiEnabled()) {
      const prompt = `You are a world-class AI technical recruiter and personal growth mentor.
Please design a personalized weekly study plan for a developer preparing for interviews.

User Profile:
- Target Role: "${targetRole}"
- Target Companies: ${JSON.stringify(targetCompanies)}
- Available Study Hours Per Week: ${availableHoursPerWeek} hours
- Days/Weeks remaining: ${durationWeeks} weeks (Urgency: "${urgency}")
- Past mock interview stats: ${totalSessions} sessions completed, average score of ${averageScore}%
- Key candidate weaknesses identified:
${JSON.stringify(weakTopics, null, 2)}

Provide a highly structured plan in JSON format. The output MUST be a JSON object, and ONLY a JSON object. No markdown, no backticks, no prefix explanations.

JSON Schema:
{
  "planTitle": "<compelling title for the study plan>",
  "weeks": [
    {
      "weekNumber": <integer starting at 1>,
      "weeklyTheme": "<focus theme of this week, e.g. Scaling Systems & Cache Optimizations>",
      "dailyTasks": [
        {
          "day": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday",
          "topic": "<specific topic to cover>",
          "activityType": "practice interview" | "study resource" | "coding exercise" | "behavioral prep",
          "durationMinutes": <integer estimated task duration, e.g., 45>,
          "completed": false
        }
      ]
    }
  ]
}`;

      try {
        const resultText = await callGemini(prompt, true);
        const cleanJson = resultText
          .replace(/^```json\s*/i, '')
          .replace(/```\s*$/, '')
          .trim();
        planData = JSON.parse(cleanJson);
      } catch (err: any) {
        logger.error({ error: err.message }, 'Gemini plan generation failed, falling back to simulated learning plan');
        planData = this.generateSimulatedPlanData(targetRole, targetCompanies, weakTopics, durationWeeks);
      }
    } else {
      planData = this.generateSimulatedPlanData(targetRole, targetCompanies, weakTopics, durationWeeks);
    }

    // 5. Save/upsert plan in database
    // Delete any active learning plan for the user before setting up the new one
    await prisma.learningPlan.deleteMany({
      where: { userId }
    });

    const newPlan = await prisma.learningPlan.create({
      data: {
        userId,
        targetCompanies: JSON.stringify(targetCompanies),
        targetRole,
        availableHoursPerWeek,
        interviewDate: interviewDate ? new Date(interviewDate) : null,
        generatedPlan: JSON.stringify(planData),
        weekStartDate: new Date(),
        isActive: true
      }
    });

    logger.info({ event: 'learning_plan_generated', userId, planId: newPlan.id }, 'Generated learning plan successfully');

    return {
      id: newPlan.id,
      targetCompanies,
      targetRole,
      availableHoursPerWeek,
      interviewDate: newPlan.interviewDate,
      generatedPlan: planData,
      weekStartDate: newPlan.weekStartDate,
      isActive: newPlan.isActive,
      urgency
    };
  }

  static generateSimulatedPlanData(role: string, companies: string[], weakTopics: any[], weeksCount: number) {
    const weeklyThemeList = [
      'Core Programming Mechanics & Data Structure Foundations',
      'Advanced Database Management, Concurrency, and Locking',
      'Distributed Caching & System Architecture Scaling',
      'Company Specific Culture, Mock Casing, and Leadership Principles'
    ];

    const weeks = [];
    const targetWeeks = Math.min(4, weeksCount);

    for (let w = 1; w <= targetWeeks; w++) {
      const theme = weeklyThemeList[w - 1] || 'General Software Engineering Polish';
      
      const dailyTasks = [
        {
          day: 'Monday',
          topic: w === 2 ? 'PostgreSQL Concurrency & Locking' : 'Algorithms: Recursion and DFS/BFS',
          activityType: 'coding exercise',
          durationMinutes: 60,
          completed: false
        },
        {
          day: 'Tuesday',
          topic: w === 3 ? 'Cache Invalidation Strategies (Redis/Memcached)' : 'System Design Fundamentals',
          activityType: 'study resource',
          durationMinutes: 45,
          completed: false
        },
        {
          day: 'Wednesday',
          topic: 'Mock Coding Interview Practice',
          activityType: 'practice interview',
          durationMinutes: 60,
          completed: false
        },
        {
          day: 'Thursday',
          topic: 'Stale Closures & Lexical Scopes in hooks',
          activityType: 'study resource',
          durationMinutes: 30,
          completed: false
        },
        {
          day: 'Friday',
          topic: 'STAR Method Behavioral Prep for ' + (companies[0] || 'Target Role'),
          activityType: 'behavioral prep',
          durationMinutes: 45,
          completed: false
        },
        {
          day: 'Saturday',
          topic: 'System Design Scaling Exercise',
          activityType: 'coding exercise',
          durationMinutes: 60,
          completed: false
        },
        {
          day: 'Sunday',
          topic: 'Week Review and Revision List Sync',
          activityType: 'study resource',
          durationMinutes: 30,
          completed: false
        }
      ];

      weeks.push({
        weekNumber: w,
        weeklyTheme: theme,
        dailyTasks
      });
    }

    return {
      planTitle: `${role} Interview Preparation Plan`,
      weeks
    };
  }

  static async getPlan(userId: string) {
    const plan = await prisma.learningPlan.findUnique({
      where: { userId }
    });

    if (!plan) {
      throw new ApiError(404, 'PLAN_NOT_FOUND', 'No active learning plan found.');
    }

    const generatedPlan = JSON.parse(plan.generatedPlan as string);

    // Calculate urgency based on interview date
    let urgency = 'normal';
    if (plan.interviewDate) {
      const daysUntil = Math.max(1, Math.round((new Date(plan.interviewDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
      if (daysUntil < 14) {
        urgency = 'urgent';
      } else if (daysUntil <= 56) {
        urgency = 'normal';
      } else {
        urgency = 'relaxed';
      }
    }

    return {
      id: plan.id,
      targetCompanies: JSON.parse(plan.targetCompanies as string),
      targetRole: plan.targetRole,
      availableHoursPerWeek: plan.availableHoursPerWeek,
      interviewDate: plan.interviewDate,
      generatedPlan,
      weekStartDate: plan.weekStartDate,
      isActive: plan.isActive,
      urgency
    };
  }

  static async toggleTask({
    userId,
    weekNumber,
    dayOfWeek,
    taskIndex
  }: {
    userId: string;
    weekNumber: number;
    dayOfWeek: string;
    taskIndex: number;
  }) {
    const plan = await prisma.learningPlan.findUnique({
      where: { userId }
    });

    if (!plan) {
      throw new ApiError(404, 'PLAN_NOT_FOUND', 'No active learning plan found.');
    }

    const planObj = JSON.parse(plan.generatedPlan as string);
    const week = planObj.weeks.find((w: any) => w.weekNumber === weekNumber);
    if (!week) {
      throw new ApiError(400, 'WEEK_NOT_FOUND', `Week ${weekNumber} does not exist in this learning plan.`);
    }

    const task = week.dailyTasks.find((t: any, idx: number) => t.day.toLowerCase() === dayOfWeek.toLowerCase() && idx === taskIndex);
    if (!task) {
      throw new ApiError(400, 'TASK_NOT_FOUND', `Task not found at day ${dayOfWeek} and index ${taskIndex}.`);
    }

    // Toggle completed state
    task.completed = !task.completed;

    const updated = await prisma.learningPlan.update({
      where: { userId },
      data: {
        generatedPlan: JSON.stringify(planObj)
      }
    });

    logger.info({ event: 'learning_plan_task_toggled', userId, weekNumber, dayOfWeek, taskIndex, completed: task.completed }, 'Toggled task completed state');

    return {
      message: 'Task updated successfully',
      generatedPlan: planObj
    };
  }

  static async addTask({
    userId,
    weekNumber,
    dayOfWeek,
    topic,
    activityType,
    durationMinutes
  }: {
    userId: string;
    weekNumber: number;
    dayOfWeek: string;
    topic: string;
    activityType: string;
    durationMinutes: number;
  }) {
    const plan = await prisma.learningPlan.findUnique({
      where: { userId }
    });

    if (!plan) {
      throw new ApiError(404, 'PLAN_NOT_FOUND', 'No active learning plan found.');
    }

    const planObj = JSON.parse(plan.generatedPlan as string);
    const week = planObj.weeks.find((w: any) => w.weekNumber === weekNumber);
    if (!week) {
      throw new ApiError(400, 'WEEK_NOT_FOUND', `Week ${weekNumber} does not exist in this learning plan.`);
    }

    if (!week.dailyTasks) {
      week.dailyTasks = [];
    }

    week.dailyTasks.push({
      day: dayOfWeek,
      topic,
      activityType,
      durationMinutes,
      completed: false
    });

    await prisma.learningPlan.update({
      where: { userId },
      data: {
        generatedPlan: JSON.stringify(planObj)
      }
    });

    logger.info({ event: 'learning_plan_task_added', userId, weekNumber, dayOfWeek, topic }, 'Added custom task to learning plan');

    return {
      message: 'Task added successfully',
      generatedPlan: planObj
    };
  }

  static async editTask({
    userId,
    weekNumber,
    dayOfWeek,
    taskIndex,
    topic,
    activityType,
    durationMinutes
  }: {
    userId: string;
    weekNumber: number;
    dayOfWeek: string;
    taskIndex: number;
    topic: string;
    activityType: string;
    durationMinutes: number;
  }) {
    const plan = await prisma.learningPlan.findUnique({
      where: { userId }
    });

    if (!plan) {
      throw new ApiError(404, 'PLAN_NOT_FOUND', 'No active learning plan found.');
    }

    const planObj = JSON.parse(plan.generatedPlan as string);
    const week = planObj.weeks.find((w: any) => w.weekNumber === weekNumber);
    if (!week) {
      throw new ApiError(400, 'WEEK_NOT_FOUND', `Week ${weekNumber} does not exist in this learning plan.`);
    }

    const task = week.dailyTasks[taskIndex];
    if (!task || task.day.toLowerCase() !== dayOfWeek.toLowerCase()) {
      throw new ApiError(400, 'TASK_NOT_FOUND', `Task not found at day ${dayOfWeek} and index ${taskIndex}.`);
    }

    task.topic = topic;
    task.activityType = activityType;
    task.durationMinutes = durationMinutes;

    await prisma.learningPlan.update({
      where: { userId },
      data: {
        generatedPlan: JSON.stringify(planObj)
      }
    });

    logger.info({ event: 'learning_plan_task_edited', userId, weekNumber, dayOfWeek, taskIndex }, 'Edited task in learning plan');

    return {
      message: 'Task edited successfully',
      generatedPlan: planObj
    };
  }

  static async deleteTask({
    userId,
    weekNumber,
    dayOfWeek,
    taskIndex
  }: {
    userId: string;
    weekNumber: number;
    dayOfWeek: string;
    taskIndex: number;
  }) {
    const plan = await prisma.learningPlan.findUnique({
      where: { userId }
    });

    if (!plan) {
      throw new ApiError(404, 'PLAN_NOT_FOUND', 'No active learning plan found.');
    }

    const planObj = JSON.parse(plan.generatedPlan as string);
    const week = planObj.weeks.find((w: any) => w.weekNumber === weekNumber);
    if (!week) {
      throw new ApiError(400, 'WEEK_NOT_FOUND', `Week ${weekNumber} does not exist in this learning plan.`);
    }

    const task = week.dailyTasks[taskIndex];
    if (!task || task.day.toLowerCase() !== dayOfWeek.toLowerCase()) {
      throw new ApiError(400, 'TASK_NOT_FOUND', `Task not found at day ${dayOfWeek} and index ${taskIndex}.`);
    }

    week.dailyTasks.splice(taskIndex, 1);

    await prisma.learningPlan.update({
      where: { userId },
      data: {
        generatedPlan: JSON.stringify(planObj)
      }
    });

    logger.info({ event: 'learning_plan_task_deleted', userId, weekNumber, dayOfWeek, taskIndex }, 'Deleted task from learning plan');

    return {
      message: 'Task deleted successfully',
      generatedPlan: planObj
    };
  }

  static async regeneratePlan(userId: string) {
    const plan = await prisma.learningPlan.findUnique({
      where: { userId }
    });

    if (!plan) {
      throw new ApiError(404, 'PLAN_NOT_FOUND', 'No learning plan to regenerate.');
    }

    // Check rate limit: cooldown once per 48 hours
    const now = new Date();
    const lastGenerated = new Date(plan.generatedAt);
    const timeDiff = now.getTime() - lastGenerated.getTime();
    const fortyEightHours = 48 * 60 * 60 * 1000;

    if (timeDiff < fortyEightHours) {
      const remainingMs = fortyEightHours - timeDiff;
      throw new ApiError(429, 'COOLDOWN_ACTIVE', 'Plan can only be regenerated once every 48 hours.', {
        cooldownRemainingMs: remainingMs
      });
    }

    const targetCompanies = JSON.parse(plan.targetCompanies as string);

    // Call generatePlan which deletes the old plan and makes a new one
    return this.generatePlan({
      userId,
      targetCompanies,
      targetRole: plan.targetRole,
      availableHoursPerWeek: plan.availableHoursPerWeek,
      interviewDate: plan.interviewDate ? plan.interviewDate.toISOString() : null
    });
  }
}

export default LearningPlanService;
