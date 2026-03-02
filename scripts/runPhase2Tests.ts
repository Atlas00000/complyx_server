/**
 * Phase 2 testing: Chat flow & completion (Week 3).
 * Run: cd server && pnpm exec tsx scripts/runPhase2Tests.ts
 *
 * Requires: server running (default 3001), DB migrated & seeded (Phase 1).
 *
 * 1. DB precondition check (users, questions)
 * 2. Start quick assessment (POST /api/assessment/start)
 * 3. Answer all questions until completed (POST /api/assessment/answer)
 * 4. Fetch completion summary (GET /api/assessment/summary/:id)
 * 5. Assert summary shape (overallPercentage, readinessBand, categoryScores, gaps, summaryText)
 * 6. Assert 404 for invalid assessment ID
 */
const API_BASE = process.env.APP_URL || 'http://localhost:3001';

async function getTestUserId(): Promise<string> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({ where: {}, select: { id: true } });
  await prisma.$disconnect();
  if (!user) throw new Error('Phase 2: No users. Run pnpm test:phase1 or db:seed:auth first.');
  return user.id;
}

async function assertDbReady(): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const userCount = await prisma.user.count();
  const questionCount = await prisma.question.count({
    where: { isActive: true },
  });
  await prisma.$disconnect();
  if (userCount < 1) throw new Error('Phase 2: No users. Run pnpm test:phase1 first.');
  if (questionCount < 5) throw new Error(`Phase 2: Need at least 5 questions, got ${questionCount}. Run db:seed:assessment.`);
}

async function main(): Promise<void> {
  console.log('🧪 Phase 2: Chat flow & completion (Week 3)\n');
  console.log('API base:', API_BASE);

  // 1. DB precondition
  console.log('\n--- 1. DB precondition ---');
  await assertDbReady();
  const userId = await getTestUserId();
  console.log('  userId:', userId);
  console.log('✓ DB ready\n');

  // 2. Start quick assessment
  console.log('--- 2. POST /api/assessment/start (quick) ---');
  let startRes: Response;
  try {
    startRes = await fetch(`${API_BASE}/api/assessment/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, assessmentType: 'quick' }),
    });
  } catch (err: unknown) {
    const cause = err instanceof Error && 'cause' in err ? (err as { cause?: { code?: string } }).cause : null;
    if (cause && typeof cause === 'object' && (cause as { code?: string }).code === 'ECONNREFUSED') {
      console.error('\n  Server not reachable at', API_BASE);
      console.error('  Start the server in another terminal: pnpm dev');
      console.error('  Then re-run: pnpm run test:phase2\n');
      process.exit(1);
    }
    throw err;
  }
  if (!startRes.ok) {
    console.error('  Start failed:', startRes.status, await startRes.text());
    process.exit(1);
  }
  const startData = (await startRes.json()) as {
    assessmentId: string;
    totalQuestions: number;
    firstQuestion: { id: string; text: string; type: string } | null;
  };
  const assessmentId = startData.assessmentId;
  let currentQuestion = startData.firstQuestion;
  console.log('  assessmentId:', assessmentId, 'totalQuestions:', startData.totalQuestions);
  if (!currentQuestion) {
    console.error('  No first question. Check question bank seed.');
    process.exit(1);
  }
  console.log('✓ Start OK\n');

  // 3. Answer all questions
  console.log('--- 3. Answer all questions ---');
  let step = 0;
  while (currentQuestion) {
    step++;
    const value =
      currentQuestion.type === 'yes_no' ? 'Yes' : currentQuestion.type === 'scale' ? '3' : 'A';
    const answerRes = await fetch(`${API_BASE}/api/assessment/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId, questionId: currentQuestion.id, value }),
    });
    if (!answerRes.ok) {
      console.error('  Answer failed:', answerRes.status, await answerRes.text());
      process.exit(1);
    }
    const answerData = (await answerRes.json()) as {
      nextQuestion: { id: string; text: string; type: string } | null;
      progress: number;
      completed: boolean;
      totalAnswered: number;
      totalQuestions: number;
    };
    console.log(`  Q${step}: progress ${answerData.progress}%, completed: ${answerData.completed}`);
    currentQuestion = answerData.nextQuestion;
    if (answerData.completed) break;
  }
  console.log('✓ All answered\n');

  // 4. Completion summary
  console.log('--- 4. GET /api/assessment/summary/:assessmentId ---');
  const summaryRes = await fetch(`${API_BASE}/api/assessment/summary/${assessmentId}`);
  if (!summaryRes.ok) {
    console.error('  Summary failed:', summaryRes.status, await summaryRes.text());
    process.exit(1);
  }
  const summary = (await summaryRes.json()) as {
    assessmentId: string;
    overallPercentage: number;
    readinessBand: string;
    categoryScores: Array<{ category: string; percentage: number; questionCount: number }>;
    gaps: Array<{ type: string; category?: string; questionText?: string; percentage?: number }>;
    summaryText: string;
  };

  // 5. Assert shape
  if (typeof summary.overallPercentage !== 'number') {
    console.error('  Missing or invalid overallPercentage');
    process.exit(1);
  }
  if (!summary.readinessBand || typeof summary.readinessBand !== 'string') {
    console.error('  Missing or invalid readinessBand');
    process.exit(1);
  }
  if (!Array.isArray(summary.categoryScores)) {
    console.error('  Missing or invalid categoryScores');
    process.exit(1);
  }
  if (typeof summary.summaryText !== 'string') {
    console.error('  Missing or invalid summaryText');
    process.exit(1);
  }
  console.log('  overallPercentage:', summary.overallPercentage);
  console.log('  readinessBand:', summary.readinessBand);
  console.log('  categoryScores:', summary.categoryScores.map((c) => `${c.category}: ${c.percentage}%`).join(', '));
  console.log('  gaps count:', summary.gaps?.length ?? 0);
  console.log('✓ Summary shape OK\n');

  // 6. 404 for invalid ID
  console.log('--- 5. GET /api/assessment/summary (invalid id) → 404 ---');
  const notFoundRes = await fetch(`${API_BASE}/api/assessment/summary/non-existent-id-12345`);
  if (notFoundRes.status !== 404) {
    console.error('  Expected 404, got:', notFoundRes.status);
    process.exit(1);
  }
  console.log('✓ 404 as expected\n');

  console.log('✅ Phase 2 (Chat flow & completion) passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
