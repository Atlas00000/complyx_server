/**
 * Phase 6 testing: Assessment context in chat (Week 7).
 * Run: cd server && pnpm exec tsx scripts/runPhase6Tests.ts
 *
 * Requires: server running (default 3001), DB migrated & seeded (Phase 1).
 *
 * 1. DB precondition; ensure user has at least one completed assessment
 * 2. POST /api/chat with userId → assert 200 and assessmentContextUsed: true
 * 3. POST /api/chat without userId → assert 200 (no assessment context)
 */
const API_BASE = process.env.APP_URL || 'http://localhost:3001';

async function getTestUserId(): Promise<string> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({ where: {}, select: { id: true } });
  await prisma.$disconnect();
  if (!user) throw new Error('Phase 6: No users. Run pnpm test:phase1 first.');
  return user.id;
}

async function ensureUserHasCompletedAssessment(userId: string): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const completed = await prisma.assessment.findFirst({
    where: { userId, status: 'completed' },
    select: { id: true },
  });
  await prisma.$disconnect();
  if (completed) return;

  // Complete a quick assessment via API
  const startRes = await fetch(`${API_BASE}/api/assessment/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, assessmentType: 'quick' }),
  });
  if (!startRes.ok) throw new Error('Phase 6: Failed to start assessment for setup.');
  const { assessmentId, firstQuestion } = (await startRes.json()) as {
    assessmentId: string;
    firstQuestion: { id: string; type: string } | null;
  };
  if (!firstQuestion) throw new Error('Phase 6: No first question.');
  let current = firstQuestion;
  while (current) {
    const value = current.type === 'yes_no' ? 'Yes' : current.type === 'scale' ? '3' : 'A';
    const answerRes = await fetch(`${API_BASE}/api/assessment/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId, questionId: current.id, value }),
    });
    if (!answerRes.ok) throw new Error('Phase 6: Failed to submit answer.');
    const data = (await answerRes.json()) as { nextQuestion: { id: string; type: string } | null; completed: boolean };
    if (data.completed) break;
    current = data.nextQuestion!;
  }
}

async function main(): Promise<void> {
  console.log('🧪 Phase 6: Assessment context in chat (Week 7)\n');
  console.log('API base:', API_BASE);

  const userId = await getTestUserId();
  console.log('  userId:', userId);

  let chatRes: Response;
  try {
    chatRes = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What should I focus on first?' }),
    });
  } catch (err: unknown) {
    const cause = err instanceof Error && 'cause' in err ? (err as { cause?: { code?: string } }).cause : null;
    if (cause && typeof cause === 'object' && (cause as { code?: string }).code === 'ECONNREFUSED') {
      console.error('\n  Server not reachable at', API_BASE);
      console.error('  Start the server: pnpm dev, then re-run: pnpm run test:phase6\n');
      process.exit(1);
    }
    throw err;
  }

  if (!chatRes.ok) {
    console.error('  Chat (no userId) failed:', chatRes.status, await chatRes.text());
    process.exit(1);
  }
  console.log('✓ Chat without userId OK\n');

  console.log('--- Ensure user has completed assessment ---');
  await ensureUserHasCompletedAssessment(userId);
  console.log('✓ User has completed assessment\n');

  console.log('--- POST /api/chat with userId ---');
  const chatWithUserRes = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'What should I improve first?',
      userId,
    }),
  });
  if (!chatWithUserRes.ok) {
    console.error('  Chat with userId failed:', chatWithUserRes.status, await chatWithUserRes.text());
    process.exit(1);
  }
  const body = (await chatWithUserRes.json()) as { message?: string; assessmentContextUsed?: boolean };
  if (body.assessmentContextUsed !== true) {
    console.error('  Expected assessmentContextUsed: true, got:', body.assessmentContextUsed);
    process.exit(1);
  }
  console.log('  assessmentContextUsed:', body.assessmentContextUsed);
  console.log('✓ Chat with userId uses assessment context\n');

  console.log('✅ Phase 6 (Assessment context in chat) passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
