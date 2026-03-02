/**
 * Test Week 1: In-chat assessment API (start, answer, status).
 * Run: cd server && tsx scripts/testWeek1Assessment.ts
 * Requires: server running on PORT (default 3001), DB migrated & seeded (auth + assessment).
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
  console.log('🧪 Week 1 Assessment API test\n');
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
    assessmentType: string;
  };
  console.log('assessmentId:', startData.assessmentId);
  console.log('totalQuestions:', startData.totalQuestions);
  console.log('firstQuestion:', startData.firstQuestion?.id, startData.firstQuestion?.text?.slice(0, 50) + '...');

  const assessmentId = startData.assessmentId;
  if (!startData.firstQuestion) {
    console.error('No first question returned. Check question bank seed (questionSet for "quick").');
    process.exit(1);
  }

  // 2. Get status
  console.log('\n--- 2. GET /api/assessment/status/:assessmentId ---');
  const statusRes1 = await fetch(`${API_BASE}/api/assessment/status/${assessmentId}`);
  if (!statusRes1.ok) {
    console.error('Status failed:', statusRes1.status, await statusRes1.text());
    process.exit(1);
  }
  const status1 = await statusRes1.json();
  console.log('status:', status1.status, 'progress:', status1.progress, 'totalAnswered:', status1.totalAnswered);

  // 3. Answer questions until completed (quick = 5 questions)
  let currentQuestion = startData.firstQuestion;
  let step = 0;
  while (currentQuestion) {
    step++;
    const value = currentQuestion.type === 'yes_no' ? 'Yes' : currentQuestion.type === 'scale' ? '3' : 'A';
    console.log(`\n--- 3.${step} POST /api/assessment/answer (q: ${currentQuestion.id}, value: ${value}) ---`);
    const answerRes = await fetch(`${API_BASE}/api/assessment/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assessmentId,
        questionId: currentQuestion.id,
        value,
      }),
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
    console.log('progress:', answerData.progress, 'completed:', answerData.completed, 'totalAnswered:', answerData.totalAnswered);
    currentQuestion = answerData.nextQuestion;
    if (answerData.completed) break;
  }

  // 4. Get final status
  console.log('\n--- 4. GET /api/assessment/status (after completion) ---');
  const statusRes2 = await fetch(`${API_BASE}/api/assessment/status/${assessmentId}`);
  const status2 = await statusRes2.json();
  console.log('status:', status2.status, 'progress:', status2.progress, 'completed:', status2.completed);

  // 5. Optional: compute scores (via service - no HTTP endpoint yet)
  console.log('\n--- 5. In-chat scoring (computeInChatScores) ---');
  const { computeInChatScores } = await import('../src/services/assessment/inChatScoringService');
  const scores = await computeInChatScores(assessmentId);
  if (scores) {
    console.log('overallPercentage:', scores.overallPercentage);
    console.log('readinessBand:', scores.readinessBand);
    console.log('categoryScores:', scores.categoryScores.map((c) => `${c.category}: ${c.percentage}%`).join(', '));
    console.log('gaps count:', scores.gaps.length);
  } else {
    console.log('(no score result - assessment may not be completed or scoring not run)');
  }

  console.log('\n✅ Week 1 assessment API test passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
