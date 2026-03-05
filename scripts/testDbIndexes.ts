import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Testing Week 1 DB indexes (Assessment, Answer, Question) ---');

  // Find a sample assessment to anchor tests
  const sampleAssessment = await prisma.assessment.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!sampleAssessment) {
    console.log('No Assessment records found. Skipping assessment/answer-specific checks.');
  } else {
    const { id: assessmentId, userId, status } = sampleAssessment;

    console.log('Sample assessment:', { assessmentId, userId, status });

    console.time('assessments_by_user');
    const assessmentsByUser = await prisma.assessment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    console.timeEnd('assessments_by_user');
    console.log('assessments_by_user count:', assessmentsByUser.length);

    console.time('assessments_by_status');
    const assessmentsByStatus = await prisma.assessment.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    console.timeEnd('assessments_by_status');
    console.log('assessments_by_status count:', assessmentsByStatus.length);

    console.time('answers_by_assessment');
    const answersByAssessment = await prisma.answer.findMany({
      where: { assessmentId },
      take: 100,
    });
    console.timeEnd('answers_by_assessment');
    console.log('answers_by_assessment count:', answersByAssessment.length);

    if (answersByAssessment[0]) {
      const { questionId } = answersByAssessment[0];
      console.time('answers_by_question');
      const answersByQuestion = await prisma.answer.findMany({
        where: { questionId },
        take: 100,
      });
      console.timeEnd('answers_by_question');
      console.log('answers_by_question count:', answersByQuestion.length);
    }
  }

  // Question/category check (independent of assessments)
  const sampleCategory = await prisma.questionCategory.findFirst();
  if (!sampleCategory) {
    console.log('No QuestionCategory records found. Skipping question/category checks.');
  } else {
    console.time('questions_by_category');
    const questionsByCategory = await prisma.question.findMany({
      where: { categoryId: sampleCategory.id },
      orderBy: { order: 'asc' },
      take: 100,
    });
    console.timeEnd('questions_by_category');
    console.log('questions_by_category count:', questionsByCategory.length);
  }

  console.log('--- DB index test completed ---');
}

main()
  .catch((err) => {
    console.error('Error during DB index test:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

