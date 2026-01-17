import { ScoringService } from '../services/assessment/scoringService';
import { ProgressService } from '../services/assessment/progressService';
import { SessionService } from '../services/assessment/sessionService';
import { QuestionService } from '../services/question/questionService';

async function testAssessmentLogic() {
  console.log('🧪 Testing Assessment Logic with Sample Data...\n');

  const scoringService = new ScoringService();
  const progressService = new ProgressService();
  const sessionService = new SessionService();
  const questionService = new QuestionService();

  try {
    // Test 1: Get sample questions for S1 quick phase
    console.log('📋 Test 1: Get sample questions for S1 quick phase');
    const s1QuickQuestions = await questionService.getQuestionsByPhase('quick', 'S1');
    console.log(`✅ Found ${s1QuickQuestions.length} S1 quick questions`);

    if (s1QuickQuestions.length === 0) {
      console.log('❌ No questions found. Please seed the database first.');
      process.exit(1);
    }

    // Test 2: Create sample answers
    console.log('\n📋 Test 2: Create sample answers');
    const sampleAnswers = s1QuickQuestions.slice(0, 5).map((q, index) => {
      let value = '';
      switch (q.type) {
        case 'yes_no':
          value = index % 2 === 0 ? 'Yes' : 'No';
          break;
        case 'multiple_choice':
          const options = q.options ? JSON.parse(q.options) : [];
          value = options[0] || 'Monthly';
          break;
        case 'text':
          value = `Sample answer for question ${q.id}. This is a detailed response with sufficient information.`;
          break;
        default:
          value = 'Sample answer';
      }
      return {
        questionId: q.id,
        value,
      };
    });

    console.log(`✅ Created ${sampleAnswers.length} sample answers`);
    sampleAnswers.forEach((a, i) => {
      const question = s1QuickQuestions[i];
      console.log(`   ${i + 1}. Q: ${question.text.substring(0, 50)}...`);
      console.log(`      A: ${a.value.substring(0, 40)}...`);
    });

    // Test 3: Calculate scores
    console.log('\n📋 Test 3: Calculate assessment scores');
    const assessmentScore = await scoringService.calculateAssessmentScore(
      sampleAnswers,
      'S1',
      'quick'
    );

    console.log(`✅ Overall Score: ${assessmentScore.overallScore.toFixed(2)} / ${assessmentScore.categoryScores.reduce((sum, cs) => sum + cs.maxScore, 0).toFixed(2)}`);
    console.log(`✅ Overall Percentage: ${assessmentScore.overallPercentage.toFixed(2)}%`);
    console.log(`✅ Total Answered: ${assessmentScore.totalAnswered} / ${assessmentScore.totalQuestions}`);

    console.log('\n📊 Category Scores:');
    assessmentScore.categoryScores.forEach((cs) => {
      console.log(`   ${cs.category}: ${cs.score.toFixed(2)} / ${cs.maxScore.toFixed(2)} (${cs.percentage.toFixed(2)}%)`);
      console.log(`     Answered: ${cs.answeredCount} / ${cs.totalCount}`);
    });

    // Test 4: Calculate progress
    console.log('\n📋 Test 4: Calculate assessment progress');
    const answeredQuestionIds = sampleAnswers.map(a => a.questionId);
    const progress = await progressService.calculateProgress(
      answeredQuestionIds,
      'S1',
      'quick'
    );

    console.log(`✅ Progress: ${progress.percentage}%`);
    console.log(`✅ Answered: ${progress.answeredCount} / ${progress.totalCount} questions`);

    // Test 5: Save session
    console.log('\n📋 Test 5: Save assessment session');
    const testAssessmentId = `test-assessment-${Date.now()}`;
    const testUserId = 'test-user@example.com';

    await sessionService.saveSession({
      assessmentId: testAssessmentId,
      userId: testUserId,
      answers: sampleAnswers,
      progress: progress.percentage,
      status: 'in_progress',
      ifrsStandard: 'S1',
      phase: 'quick',
    });

    console.log(`✅ Session saved with ID: ${testAssessmentId}`);

    // Test 6: Restore session
    console.log('\n📋 Test 6: Restore assessment session');
    const restoredSession = await sessionService.restoreSession(testAssessmentId);

    if (restoredSession) {
      console.log(`✅ Session restored successfully`);
      console.log(`   Assessment ID: ${restoredSession.assessmentId}`);
      console.log(`   Progress: ${restoredSession.progress}%`);
      console.log(`   Status: ${restoredSession.status}`);
      console.log(`   Answers: ${restoredSession.answers.length}`);
    } else {
      console.log('❌ Failed to restore session');
    }

    // Test 7: Get user assessments
    console.log('\n📋 Test 7: Get user assessments');
    const userAssessments = await sessionService.getUserAssessments(testUserId);
    console.log(`✅ Found ${userAssessments.length} assessments for user`);
    userAssessments.forEach((assessment, index) => {
      console.log(`   ${index + 1}. ${assessment.id}`);
      console.log(`      Status: ${assessment.status}, Progress: ${assessment.progress}%`);
      console.log(`      Updated: ${assessment.updatedAt.toISOString()}`);
    });

    // Test 8: Calculate and save scores to database
    console.log('\n📋 Test 8: Calculate and save scores to database');
    await scoringService.calculateAndSaveScores(
      testAssessmentId,
      sampleAnswers,
      'S1',
      'quick'
    );

    const savedScores = await scoringService.getAssessmentScores(testAssessmentId);
    console.log(`✅ Saved ${savedScores.length} category scores to database`);
    savedScores.forEach((score) => {
      console.log(`   ${score.category}: ${score.score.toFixed(2)} / ${score.maxScore.toFixed(2)} (${score.percentage.toFixed(2)}%)`);
    });

    // Test 9: Update progress
    console.log('\n📋 Test 9: Update assessment progress');
    await progressService.updateAssessmentProgress(testAssessmentId, 75);
    const updatedProgress = await progressService.getAssessmentProgress(testAssessmentId);
    console.log(`✅ Progress updated to: ${updatedProgress}%`);

    // Test 10: Mark assessment as completed
    console.log('\n📋 Test 10: Mark assessment as completed');
    await progressService.markAssessmentCompleted(testAssessmentId);
    const finalRestored = await sessionService.restoreSession(testAssessmentId);
    if (finalRestored) {
      console.log(`✅ Assessment marked as completed`);
      console.log(`   Final status: ${finalRestored.status}`);
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await sessionService.deleteSession(testAssessmentId);
    console.log('✅ Test data cleaned up');

    console.log('\n✅ All assessment logic tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

testAssessmentLogic()
  .then(() => {
    console.log('\n🎉 Assessment logic testing completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
