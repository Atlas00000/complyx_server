/**
 * Test Week 8: Contextual answer detection and storage.
 * Run: cd server && pnpm exec tsx scripts/testWeek8Contextual.ts
 * Requires: DB migrated & seeded (auth + assessment questions). Optional: server running for chat flow.
 */
import { PrismaClient } from '@prisma/client';
import {
  detectPillar,
  processContextualMessage,
} from '../src/services/assessment/contextualAnswerService';

const prisma = new PrismaClient();

async function getTestUserId(): Promise<string> {
  const user = await prisma.user.findFirst({ where: {}, select: { id: true } });
  if (!user) throw new Error('No user in DB. Run pnpm db:seed:auth first.');
  return user.id;
}

async function main() {
  console.log('🧪 Week 8 Contextual answers test\n');

  const userId = await getTestUserId();
  console.log('Test userId:', userId);

  // 1. detectPillar
  console.log('\n--- 1. detectPillar ---');
  const governanceMsg = 'We have board oversight and a sustainability committee.';
  const strategyMsg = 'Our strategy includes climate scenario analysis.';
  const riskMsg = 'We are assessing climate-related risks.';
  const metricsMsg = 'We report scope 1 and scope 2 emissions.';
  const noneMsg = 'What is the weather today?';

  console.log('  governance:', detectPillar(governanceMsg));
  console.log('  strategy:', detectPillar(strategyMsg));
  console.log('  risk:', detectPillar(riskMsg));
  console.log('  metrics:', detectPillar(metricsMsg));
  console.log('  none:', detectPillar(noneMsg));

  if (detectPillar(governanceMsg) !== 'governance') {
    console.error('Expected pillar "governance" for governance message');
    process.exit(1);
  }
  if (detectPillar(noneMsg) !== null) {
    console.error('Expected pillar null for irrelevant message');
    process.exit(1);
  }

  // 2. Ensure user has an assessment (create one if not)
  let assessment = await prisma.assessment.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!assessment) {
    const q = await prisma.question.findFirst({ where: { isActive: true }, select: { id: true } });
    if (!q) throw new Error('No questions. Run pnpm db:seed:assessment first.');
    assessment = await prisma.assessment.create({
      data: {
        userId,
        status: 'in_progress',
        assessmentType: 'full',
        totalQuestions: 1,
      },
      select: { id: true },
    });
    console.log('\nCreated in-progress assessment:', assessment.id);
  } else {
    console.log('\nUsing existing assessment:', assessment.id);
  }

  // 3. processContextualMessage
  console.log('\n--- 2. processContextualMessage ---');
  const result = await processContextualMessage(userId, governanceMsg);
  console.log('  result:', result);

  // 4. Verify optional: one contextual answer may exist
  const answers = await prisma.answer.findMany({
    where: { assessmentId: assessment.id, value: { contains: '[contextual]' } },
    take: 5,
  });
  console.log('\n--- 3. Contextual answers in DB ---');
  console.log('  count:', answers.length);
  if (answers.length > 0) {
    console.log('  sample:', answers[0].value.slice(0, 80) + '...');
  }

  console.log('\n✅ Week 8 contextual flow test passed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
