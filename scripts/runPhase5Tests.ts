/**
 * Phase 5 testing: Scoring & gaps (Week 6).
 * Run: cd server && pnpm exec tsx scripts/runPhase5Tests.ts
 *
 * Requires: server running (default 3001), DB migrated & seeded (Phase 1).
 *
 * 1. DB precondition
 * 2. Start quick assessment, answer with mixed values (some low to trigger gaps)
 * 3. Fetch completion summary
 * 4. Assert scoring: overallPercentage 0–100, readinessBand, categoryScores
 * 5. Assert gaps: structure and optional presence when scores are low
 * 6. Assert summaryText and readinessBandMessage
 */
const API_BASE = process.env.APP_URL || 'http://localhost:3001';

async function getTestUserId(): Promise<string> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({ where: {}, select: { id: true } });
  await prisma.$disconnect();
  if (!user) throw new Error('Phase 5: No users. Run pnpm test:phase1 first.');
  return user.id;
}

async function assertDbReady(): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const userCount = await prisma.user.count();
  const questionCount = await prisma.question.count({ where: { isActive: true } });
  await prisma.$disconnect();
  if (userCount < 1) throw new Error('Phase 5: No users.');
  if (questionCount < 5) throw new Error(`Phase 5: Need at least 5 questions, got ${questionCount}.`);
}

async function main(): Promise<void> {
  console.log('🧪 Phase 5: Scoring & gaps (Week 6)\n');
  console.log('API base:', API_BASE);

  await assertDbReady();
  const userId = await getTestUserId();
  console.log('  userId:', userId);
  console.log('✓ DB ready\n');

  // Start quick assessment
  console.log('--- 1. Start quick assessment ---');
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
      console.error('  Start the server: pnpm dev, then re-run: pnpm run test:phase5\n');
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
  if (!currentQuestion) {
    console.error('  No first question.');
    process.exit(1);
  }
  console.log('  assessmentId:', assessmentId, 'totalQuestions:', startData.totalQuestions);
  console.log('✓ Start OK\n');

  // Answer with mixed values: alternate Yes/No, use "3" for scale, first option for MC; use "No" and low to get varied scores
  console.log('--- 2. Answer with mixed values ---');
  let step = 0;
  while (currentQuestion) {
    step++;
    let value: string;
    if (currentQuestion.type === 'yes_no') {
      value = step % 2 === 0 ? 'Yes' : 'No';
    } else if (currentQuestion.type === 'scale') {
      value = step % 3 === 0 ? '1' : step % 3 === 1 ? '3' : '5';
    } else {
      value = step % 2 === 0 ? 'A' : 'B';
    }
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
      completed: boolean;
      totalAnswered: number;
    };
    currentQuestion = answerData.nextQuestion;
    if (answerData.completed) break;
  }
  console.log('  Answered', step, 'questions.');
  console.log('✓ Answers OK\n');

  // Fetch summary
  console.log('--- 3. GET /api/assessment/summary/:assessmentId ---');
  const summaryRes = await fetch(`${API_BASE}/api/assessment/summary/${assessmentId}`);
  if (!summaryRes.ok) {
    console.error('  Summary failed:', summaryRes.status, await summaryRes.text());
    process.exit(1);
  }
  const summary = (await summaryRes.json()) as {
    assessmentId: string;
    overallPercentage: number;
    readinessBand: string;
    readinessBandMessage?: string;
    categoryScores: Array<{ category: string; percentage: number; questionCount: number }>;
    gaps: Array<{ type: string; category?: string; questionText?: string; percentage?: number }>;
    summaryText: string;
  };

  // Assert scoring
  console.log('--- 4. Assert scoring ---');
  if (typeof summary.overallPercentage !== 'number' || summary.overallPercentage < 0 || summary.overallPercentage > 100) {
    console.error('  Invalid overallPercentage:', summary.overallPercentage);
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
  console.log('  overallPercentage:', summary.overallPercentage);
  console.log('  readinessBand:', summary.readinessBand);
  console.log('  categoryScores:', summary.categoryScores.map((c) => `${c.category}: ${c.percentage}%`).join(', '));
  console.log('✓ Scoring OK\n');

  // Assert gaps structure
  console.log('--- 5. Assert gaps ---');
  if (!Array.isArray(summary.gaps)) {
    console.error('  Missing or invalid gaps');
    process.exit(1);
  }
  console.log('  gaps count:', summary.gaps.length);
  console.log('✓ Gaps OK\n');

  // Assert summary text and band message
  console.log('--- 6. Assert summary text ---');
  if (typeof summary.summaryText !== 'string') {
    console.error('  Missing or invalid summaryText');
    process.exit(1);
  }
  if (summary.readinessBandMessage != null && typeof summary.readinessBandMessage !== 'string') {
    console.error('  Invalid readinessBandMessage');
    process.exit(1);
  }
  console.log('  summaryText length:', summary.summaryText.length);
  if (summary.readinessBandMessage) console.log('  readinessBandMessage:', summary.readinessBandMessage.slice(0, 60) + '...');
  console.log('✓ Summary text OK\n');

  console.log('✅ Phase 5 (Scoring & gaps) passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
