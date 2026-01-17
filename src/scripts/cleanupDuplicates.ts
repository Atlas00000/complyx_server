import { prisma } from '../utils/db';

async function cleanupDuplicates() {
  console.log('🧹 Cleaning up duplicate questions...\n');

  try {
    // Get all questions grouped by text and ifrsStandard
    const allQuestions = await prisma.question.findMany({
      orderBy: [
        { ifrsStandard: 'asc' },
        { text: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // Group by text and ifrsStandard
    const questionGroups = new Map<string, typeof allQuestions>();
    
    for (const question of allQuestions) {
      const key = `${question.text}|${question.ifrsStandard}`;
      if (!questionGroups.has(key)) {
        questionGroups.set(key, []);
      }
      questionGroups.get(key)!.push(question);
    }

    // Find duplicates
    let duplicatesRemoved = 0;
    const duplicatesToDelete: string[] = [];

    for (const [key, questions] of questionGroups.entries()) {
      if (questions.length > 1) {
        console.log(`Found ${questions.length} duplicates for: ${questions[0].text.substring(0, 60)}...`);
        
        // Keep the first one (oldest), delete the rest
        const toKeep = questions[0];
        const toDelete = questions.slice(1);
        
        console.log(`  Keeping: ${toKeep.id} (created: ${toKeep.createdAt})`);
        
        for (const dup of toDelete) {
          console.log(`  Deleting: ${dup.id} (created: ${dup.createdAt})`);
          duplicatesToDelete.push(dup.id);
          duplicatesRemoved++;
        }
      }
    }

    // Delete duplicates
    if (duplicatesToDelete.length > 0) {
      console.log(`\n🗑️  Deleting ${duplicatesToDelete.length} duplicate questions...`);
      
      // Delete answers associated with duplicate questions first
      await prisma.answer.deleteMany({
        where: {
          questionId: {
            in: duplicatesToDelete,
          },
        },
      });

      // Delete duplicate questions
      await prisma.question.deleteMany({
        where: {
          id: {
            in: duplicatesToDelete,
          },
        },
      });

      console.log(`✅ Deleted ${duplicatesRemoved} duplicate questions`);
    } else {
      console.log('✅ No duplicates found');
    }

    // Show final counts
    const finalCounts = await prisma.question.groupBy({
      by: ['ifrsStandard', 'phase'],
      _count: true,
    });

    console.log('\n📊 Final question counts:');
    for (const count of finalCounts) {
      console.log(`   ${count.ifrsStandard} - ${count.phase}: ${count._count} questions`);
    }

    console.log('\n✅ Cleanup completed!');
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    process.exit(1);
  }
}

cleanupDuplicates()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
