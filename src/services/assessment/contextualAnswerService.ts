import { prisma } from '../../utils/db';

const PILLAR_KEYWORDS: Record<string, string[]> = {
  governance: [
    'board', 'oversight', 'committee', 'governance', 'executive', 'responsibility',
    'controls', 'processes', 'reporting', 'competence', 'training', 'internal control',
  ],
  strategy: [
    'strategy', 'strategic', 'integration', 'business model', 'time horizon',
    'scenario', 'climate scenario', 'transition', 'sustainability strategy',
  ],
  risk: [
    'risk', 'risks', 'identification', 'assessment', 'manage risk', 'risk management',
    'climate risk', 'sustainability risk', 'opportunities',
  ],
  metrics: [
    'metrics', 'targets', 'kpi', 'measure', 'emissions', 'scope 1', 'scope 2', 'scope 3',
    'ghg', 'carbon', 'disclosure', 'data', 'reporting',
  ],
};

type Pillar = 'governance' | 'strategy' | 'risk' | 'metrics';

/**
 * Detect which assessment pillar (if any) the message is about.
 */
export function detectPillar(message: string): Pillar | null {
  const lower = message.trim().toLowerCase();
  if (lower.length < 10) return null;

  let best: { pillar: Pillar; count: number } | null = null;
  for (const [pillar, keywords] of Object.entries(PILLAR_KEYWORDS)) {
    const count = keywords.filter((k) => lower.includes(k)).length;
    if (count > 0 && (!best || count > best.count)) {
      best = { pillar: pillar as Pillar, count };
    }
  }
  return best?.pillar ?? null;
}

function getQuestionSetKey(assessmentType: string, microTopic: string | null): string {
  if (assessmentType === 'micro' && microTopic) return `micro_${microTopic}`;
  return assessmentType;
}

/**
 * Get question IDs for an assessment's type/topic (same logic as in-chat assessment).
 */
async function getQuestionIdsForAssessment(
  assessmentType: string,
  microTopic: string | null
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
    select: { id: true, categoryId: true },
  });
  return questions.map((q) => q.id);
}

/**
 * Get first question ID in the assessment's set that belongs to the given pillar (category name).
 */
async function getFirstQuestionIdForPillar(
  assessmentId: string,
  pillar: Pillar
): Promise<string | null> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { assessmentType: true, microTopic: true },
  });
  if (!assessment) return null;

  const questionIds = await getQuestionIdsForAssessment(
    assessment.assessmentType,
    assessment.microTopic
  );
  if (questionIds.length === 0) return null;

  const withCategory = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    include: { category: true },
    orderBy: { order: 'asc' },
  });
  const first = withCategory.find((q) => q.category.name.toLowerCase() === pillar);
  return first?.id ?? null;
}

/**
 * Store a contextual answer (from chat) as an Answer on the assessment.
 * Skips if this assessment already has an answer for this question.
 */
export async function storeContextualAnswer(
  assessmentId: string,
  questionId: string,
  value: string
): Promise<boolean> {
  const existing = await prisma.answer.findFirst({
    where: { assessmentId, questionId },
  });
  if (existing) return false;

  const snippet = value.trim().slice(0, 500);
  await prisma.answer.create({
    data: { assessmentId, questionId, value: `[contextual] ${snippet}` },
  });
  return true;
}

/**
 * Process a user chat message: if it looks assessment-relevant and the user has an assessment,
 * map to a question and store as a contextual answer. Call after sending the chat response.
 */
export async function processContextualMessage(
  userId: string,
  message: string
): Promise<{ stored: boolean; pillar?: Pillar }> {
  const pillar = detectPillar(message);
  if (!pillar) return { stored: false };

  const latest = await prisma.assessment.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!latest) return { stored: false, pillar };

  const questionId = await getFirstQuestionIdForPillar(latest.id, pillar);
  if (!questionId) return { stored: false, pillar };

  const stored = await storeContextualAnswer(latest.id, questionId, message);
  return { stored, pillar };
}
