import { prisma } from '../../utils/db';
import type { AssessmentQuestionBlock, AssessmentQuestionBlockPayload } from '../../types/assessment';

export type AssessmentType = 'quick' | 'micro' | 'full';
export type MicroTopic = 'governance' | 'strategy' | 'risk' | 'metrics';

export interface StartAssessmentInput {
  userId: string;
  sessionId?: string;
  assessmentType: AssessmentType;
  microTopic?: MicroTopic;
}

export interface StartAssessmentResult {
  assessmentId: string;
  totalQuestions: number;
  firstQuestion: QuestionForAssessment | null;
  firstQuestionBlock?: AssessmentQuestionBlock | null;
  assessmentType: AssessmentType;
  microTopic?: MicroTopic;
}

export interface QuestionForAssessment {
  id: string;
  text: string;
  type: string;
  options: string | null;
  order: number;
  categoryName: string;
}

export interface SubmitAnswerInput {
  assessmentId: string;
  questionId: string;
  value: string;
}

export interface SubmitAnswerResult {
  assessmentId: string;
  nextQuestion: QuestionForAssessment | null;
  nextQuestionBlock?: AssessmentQuestionBlock | null;
  progress: number;
  completed: boolean;
  totalAnswered: number;
  totalQuestions: number;
}

export interface AssessmentStatusResult {
  assessmentId: string;
  status: string;
  progress: number;
  assessmentType: AssessmentType;
  microTopic?: MicroTopic;
  totalQuestions: number;
  totalAnswered: number;
  completed: boolean;
  currentQuestion: QuestionForAssessment | null;
  currentQuestionBlock?: AssessmentQuestionBlock | null;
}

/**
 * Get question set key for DB lookup: full, quick, or micro_<topic>
 */
function getQuestionSetKey(assessmentType: AssessmentType, microTopic?: MicroTopic): string {
  if (assessmentType === 'micro' && microTopic) {
    return `micro_${microTopic}`;
  }
  return assessmentType;
}

/**
 * Fetch ordered question IDs for an assessment type from Question table (questionSet JSON).
 */
async function getQuestionIdsForType(
  assessmentType: AssessmentType,
  microTopic?: MicroTopic
): Promise<string[]> {
  const setKey = getQuestionSetKey(assessmentType, microTopic);
  const questions = await prisma.question.findMany({
    where: {
      isActive: true,
      OR: [
        { questionSet: { contains: setKey } },
        { questionSet: { contains: `"${setKey}"` } },
      ],
    },
    orderBy: { order: 'asc' },
    select: { id: true },
  });
  return questions.map((q) => q.id);
}

/**
 * Normalize skip / "I don't know" answers to a canonical value for storage and scoring.
 */
function normalizeAnswerValue(value: string): string {
  const v = value.trim().toLowerCase();
  if (!v) return value;
  if (
    v === 'skip' ||
    v === 'skipped' ||
    v === "i don't know" ||
    v === "i do not know" ||
    v === 'idk' ||
    v === 'dont know' ||
    v === 'don\'t know' ||
    v === 'not sure' ||
    v === 'pass'
  ) {
    return 'skip';
  }
  return value;
}

/**
 * Build rich question block payload for MC/Yes/No/Scale (for client AssessmentQuestionBubble).
 */
function toQuestionBlock(q: QuestionForAssessment): AssessmentQuestionBlock | null {
  const questionType = q.type as AssessmentQuestionBlockPayload['questionType'];
  if (questionType !== 'multiple_choice' && questionType !== 'yes_no' && questionType !== 'scale' && questionType !== 'text') {
    return null;
  }
  const payload: AssessmentQuestionBlockPayload = {
    questionId: q.id,
    text: q.text,
    questionType,
    categoryName: q.categoryName,
    scaleMin: 1,
    scaleMax: 5,
  };
  if (questionType === 'multiple_choice' && q.options) {
    try {
      const parsed = JSON.parse(q.options) as Array<{ value?: string; label?: string; score?: number }>;
      payload.options = parsed.map((o) => ({
        value: String(o.value ?? o.label ?? ''),
        label: o.label != null ? String(o.label) : undefined,
        score: typeof o.score === 'number' ? o.score : undefined,
      }));
    } catch {
      payload.options = [];
    }
  }
  return { type: 'assessment_question', payload };
}

/**
 * Fetch a single question with category for display.
 */
async function getQuestionById(questionId: string): Promise<QuestionForAssessment | null> {
  const q = await prisma.question.findUnique({
    where: { id: questionId },
    include: { category: true },
  });
  if (!q) return null;
  return {
    id: q.id,
    text: q.text,
    type: q.type,
    options: q.options,
    order: q.order,
    categoryName: q.category.name,
  };
}

/**
 * In-chat assessment service: start session, submit answers, get status.
 */
export class InChatAssessmentService {
  /**
   * Start a new in-chat assessment.
   */
  async startAssessment(input: StartAssessmentInput): Promise<StartAssessmentResult> {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!user) {
      throw new Error('User not found. Please log in again.');
    }

    const questionIds = await getQuestionIdsForType(input.assessmentType, input.microTopic);
    const totalQuestions = questionIds.length;

    const assessment = await prisma.assessment.create({
      data: {
        userId: input.userId,
        sessionId: input.sessionId ?? null,
        status: 'in_progress',
        progress: 0,
        assessmentType: input.assessmentType,
        microTopic: input.microTopic ?? null,
        totalQuestions,
      },
    });

    const firstQuestion =
      questionIds.length > 0 ? await getQuestionById(questionIds[0]) : null;
    const firstQuestionBlock = firstQuestion ? toQuestionBlock(firstQuestion) : null;

    return {
      assessmentId: assessment.id,
      totalQuestions,
      firstQuestion,
      firstQuestionBlock,
      assessmentType: input.assessmentType,
      microTopic: input.microTopic,
    };
  }

  /**
   * Submit an answer and get the next question (or completion).
   */
  async submitAnswer(input: SubmitAnswerInput): Promise<SubmitAnswerResult> {
    const assessment = await prisma.assessment.findUnique({
      where: { id: input.assessmentId },
      include: { answers: { select: { questionId: true } } },
    });

    if (!assessment) {
      throw new Error('Assessment not found');
    }
    if (assessment.status === 'completed') {
      throw new Error('Assessment already completed');
    }

    const normalizedValue = normalizeAnswerValue(input.value);

    await prisma.answer.create({
      data: {
        assessmentId: input.assessmentId,
        questionId: input.questionId,
        value: normalizedValue,
      },
    });

    const questionIds = await getQuestionIdsForType(
      assessment.assessmentType as AssessmentType,
      (assessment.microTopic ?? undefined) as MicroTopic | undefined
    );
    const answeredIds = new Set(
      (await prisma.answer.findMany({
        where: { assessmentId: input.assessmentId },
        select: { questionId: true },
      })).map((a) => a.questionId)
    );

    const nextQuestionId = questionIds.find((id) => !answeredIds.has(id));
    const totalAnswered = answeredIds.size;
    const totalQuestions = questionIds.length;
    const progress = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0;

    let nextQuestion: QuestionForAssessment | null = null;
    let completed = false;

    if (nextQuestionId) {
      nextQuestion = await getQuestionById(nextQuestionId);
    } else {
      completed = true;
      await prisma.assessment.update({
        where: { id: input.assessmentId },
        data: { status: 'completed', progress: 100, completedAt: new Date() },
      });
    }

    if (!completed) {
      await prisma.assessment.update({
        where: { id: input.assessmentId },
        data: { progress },
      });
    }

    const nextQuestionBlock = nextQuestion ? toQuestionBlock(nextQuestion) : null;

    return {
      assessmentId: input.assessmentId,
      nextQuestion,
      nextQuestionBlock,
      progress,
      completed,
      totalAnswered,
      totalQuestions,
    };
  }

  /**
   * Get current assessment status and current/next question.
   */
  async getStatus(assessmentId: string): Promise<AssessmentStatusResult | null> {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
    });
    if (!assessment) return null;

    const questionIds = await getQuestionIdsForType(
      assessment.assessmentType as AssessmentType,
      (assessment.microTopic ?? undefined) as MicroTopic | undefined
    );
    const answers = await prisma.answer.findMany({
      where: { assessmentId },
      select: { questionId: true },
    });
    const answeredSet = new Set(answers.map((a) => a.questionId));
    const totalAnswered = answers.length;
    const totalQuestions = questionIds.length;
    const currentQuestionId = questionIds.find((id) => !answeredSet.has(id));
    const currentQuestion = currentQuestionId
      ? await getQuestionById(currentQuestionId)
      : null;
    const currentQuestionBlock = currentQuestion ? toQuestionBlock(currentQuestion) : null;

    return {
      assessmentId: assessment.id,
      status: assessment.status,
      progress: assessment.progress,
      assessmentType: assessment.assessmentType as AssessmentType,
      microTopic: assessment.microTopic as MicroTopic | undefined,
      totalQuestions,
      totalAnswered,
      completed: assessment.status === 'completed',
      currentQuestion,
      currentQuestionBlock,
    };
  }
}
