/**
 * Test Week 3: Text-based assessment flow + completion summary API.
 * Run: cd server && pnpm exec tsx scripts/testWeek3Assessment.ts
 * Requires: server running (default 3001), DB migrated & seeded (auth + assessment).
 */
const API_BASE = process.env.APP_URL || 'http://localhost:3001';

async function getTestUserId(): Promise<string> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({ where: {}, select: { id: true } });
  await prisma.$disconnect();
  if (!user) throw new Error('No user in DB. Run pnpm db:seed:auth first.');
  return user.id;
}

async function main() {
  console.log('🧪 Week 3 Assessment flow + completion summary test\n');
  console.log('API base:', API_BASE);

  const userId = await getTestUserId();
  console.log('Test userId:', userId);

  // 1. Start quick assessment
  console.log('\n--- 1. POST /api/assessment/start (quick) ---');
  const startRes = await fetch(`${API_BASE}/api/assessment/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, assessmentType: 'quick' }),
  });
  if (!startRes.ok) {
    console.error('Start failed:', startRes.status, await startRes.text());
    process.exit(1);
  }
  const startData = (await startRes.json()) as {
    assessmentId: string;
    totalQuestions: number;
    firstQuestion: { id: string; text: string; type: string } | null;
  };
  const assessmentId = startData.assessmentId;
  console.log('assessmentId:', assessmentId, 'totalQuestions:', startData.totalQuestions);

  let currentQuestion = startData.firstQuestion;
  if (!currentQuestion) {
    console.error('No first question. Check question bank seed.');
    process.exit(1);
  }

  // 2. Answer all questions until completed
  console.log('\n--- 2. Answer all questions ---');
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
      console.error('Answer failed:', answerRes.status, await answerRes.text());
      process.exit(1);
    }
    const answerData = (await answerRes.json()) as {
      nextQuestion: { id: string; text: string; type: string } | null;
      progress: number;
      completed: boolean;
      totalAnswered: number;
      totalQuestions: number;
    };
    console.log(
      `  Q${step}: ${currentQuestion.id} → progress ${answerData.progress}%, completed: ${answerData.completed}`
    );
    currentQuestion = answerData.nextQuestion;
    if (answerData.completed) break;
  }

  console.log('  Assessment completed.');

  // 3. GET /api/assessment/summary/:assessmentId (Week 3)
  console.log('\n--- 3. GET /api/assessment/summary/:assessmentId ---');
  const summaryRes = await fetch(`${API_BASE}/api/assessment/summary/${assessmentId}`);
  if (!summaryRes.ok) {
    console.error('Summary failed:', summaryRes.status, await summaryRes.text());
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

  // Assert Week 3 completion summary shape
  if (typeof summary.overallPercentage !== 'number') {
    console.error('Missing or invalid overallPercentage');
    process.exit(1);
  }
  if (!summary.readinessBand || typeof summary.readinessBand !== 'string') {
    console.error('Missing or invalid readinessBand');
    process.exit(1);
  }
  if (!Array.isArray(summary.categoryScores)) {
    console.error('Missing or invalid categoryScores');
    process.exit(1);
  }
  if (typeof summary.summaryText !== 'string') {
    console.error('Missing or invalid summaryText');
    process.exit(1);
  }

  console.log('overallPercentage:', summary.overallPercentage);
  console.log('readinessBand:', summary.readinessBand);
  console.log(
    'categoryScores:',
    summary.categoryScores.map((c) => `${c.category}: ${c.percentage}%`).join(', ')
  );
  console.log('gaps count:', summary.gaps?.length ?? 0);
  console.log('summaryText (first 120 chars):', summary.summaryText.slice(0, 120) + '...');

  // 4. Summary for non-existent ID returns 404
  console.log('\n--- 4. GET /api/assessment/summary (invalid id) → 404 ---');
  const notFoundRes = await fetch(`${API_BASE}/api/assessment/summary/non-existent-id-12345`);
  if (notFoundRes.status !== 404) {
    console.error('Expected 404 for invalid assessment id, got:', notFoundRes.status);
    process.exit(1);
  }
  console.log('  Got 404 as expected.');

  console.log('\n✅ Week 3 assessment flow + completion summary test passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
