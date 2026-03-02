/**
 * Phase 1 testing: Backend & question bank (Weeks 1–2).
 * Run: cd server && pnpm exec tsx scripts/runPhase1Tests.ts
 *
 * 1. DB migration (already applied – no-op if up to date)
 * 2. Auth seed (users, roles)
 * 3. Assessment seed (categories, questions, questionSet)
 * 4. DB verification (user count, question count, questionSet for quick/full)
 * 5. Instructions for API test (testWeek1Assessment.ts – requires server)
 */
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';

const prisma = new PrismaClient();
const serverDir = path.resolve(__dirname, '..');

function run(cmd: string, env?: Record<string, string>): void {
  execSync(cmd, { cwd: serverDir, stdio: 'inherit', env: { ...process.env, ...env } });
}

async function main() {
  console.log('🧪 Phase 1: Backend & question bank\n');

  // 1. Migration
  console.log('--- 1. DB migration ---');
  try {
    run('pnpm exec prisma migrate deploy');
  } catch {
    console.log('(migrate deploy failed or not needed; ensure DB is up and migrated)');
  }
  console.log('✓ Migration step done\n');

  // 2. Auth seed
  console.log('--- 2. Auth seed ---');
  run('pnpm run db:seed:auth');
  console.log('✓ Auth seed done\n');

  // 3. Assessment seed
  console.log('--- 3. Assessment question seed ---');
  run('pnpm run db:seed:assessment');
  console.log('✓ Assessment seed done\n');

  // 4. DB verification
  console.log('--- 4. DB verification ---');
  const userCount = await prisma.user.count();
  const questionCount = await prisma.question.count();
  const categories = await prisma.questionCategory.findMany({ select: { name: true }, orderBy: { name: 'asc' } });
  const quickQuestions = await prisma.question.count({
    where: {
      isActive: true,
      OR: [
        { questionSet: { contains: 'quick' } },
        { questionSet: { contains: '"quick"' } },
      ],
    },
  });
  const fullQuestions = await prisma.question.count({
    where: {
      isActive: true,
      OR: [
        { questionSet: { contains: 'full' } },
        { questionSet: { contains: '"full"' } },
      ],
    },
  });

  if (userCount < 1) throw new Error('Phase 1: No users found. Run db:seed:auth.');
  if (questionCount < 15) throw new Error(`Phase 1: Expected at least 15 questions, got ${questionCount}.`);
  if (categories.length < 4) throw new Error(`Phase 1: Expected 4 categories, got ${categories.length}.`);
  if (quickQuestions < 5) throw new Error(`Phase 1: Expected at least 5 questions in quick set, got ${quickQuestions}.`);
  if (fullQuestions < 15) throw new Error(`Phase 1: Expected at least 15 questions in full set, got ${fullQuestions}.`);

  console.log('  Users:', userCount);
  console.log('  Questions:', questionCount);
  console.log('  Categories:', categories.map((c) => c.name).join(', '));
  console.log('  Quick set size:', quickQuestions);
  console.log('  Full set size:', fullQuestions);
  console.log('✓ DB verification passed\n');

  // 5. API test instructions
  console.log('--- 5. API tests (start / answer / status) ---');
  console.log('  Start the server in another terminal: pnpm dev');
  console.log('  Then run: pnpm exec tsx scripts/testWeek1Assessment.ts');
  console.log('✓ Phase 1 DB and seeds complete. Run the command above to complete API checks.\n');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
