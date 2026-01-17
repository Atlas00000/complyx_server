import { QuestionService } from '../services/question/questionService';
import { PhaseService } from '../services/question/phaseService';
import { AdaptiveQuestioning } from '../services/question/adaptiveQuestioning';

async function testPhaseSystem() {
  console.log('🧪 Testing Phase-Based Question System...\n');

  const questionService = new QuestionService();
  const phaseService = new PhaseService(questionService);
  const adaptiveQuestioning = new AdaptiveQuestioning(questionService);

  try {
    // Test 1: Get phase information
    console.log('📋 Test 1: Get phase information');
    const phaseInfo = await phaseService.getPhaseInfo('S1');
    console.log(`✅ Found ${phaseInfo.length} phases:`);
    phaseInfo.forEach(phase => {
      console.log(`   - ${phase.name}: ${phase.questionCount} questions (${phase.estimatedTime})`);
    });
    console.log('');

    // Test 2: Get quick phase questions
    console.log('📋 Test 2: Get quick phase questions');
    const quickQuestions = await questionService.getQuestionsByPhase('quick', 'S1');
    console.log(`✅ Found ${quickQuestions.length} quick phase questions`);
    if (quickQuestions.length > 0) {
      console.log(`   Sample: ${quickQuestions[0].text.substring(0, 60)}...`);
    }
    console.log('');

    // Test 3: Get detailed phase questions
    console.log('📋 Test 3: Get detailed phase questions');
    const detailedQuestions = await questionService.getQuestionsByPhase('detailed', 'S1');
    console.log(`✅ Found ${detailedQuestions.length} detailed phase questions`);
    console.log('');

    // Test 4: Adaptive questioning with quick phase
    console.log('📋 Test 4: Adaptive questioning - quick phase');
    const flowState = {
      answeredQuestions: new Set<string>(),
      answeredAnswers: [],
      currentPhase: 'quick' as const,
    };
    const nextQuestion = await adaptiveQuestioning.getNextQuestion(flowState, 'S1', 'quick');
    if (nextQuestion) {
      console.log(`✅ Next question: ${nextQuestion.text.substring(0, 60)}...`);
      console.log(`   Phase: ${nextQuestion.phase}`);
      console.log(`   Category: ${nextQuestion.category.name}`);
    }
    console.log('');

    // Test 5: Check phase completion
    console.log('📋 Test 5: Check phase completion');
    const quickAnswered = new Set(quickQuestions.map(q => q.id));
    const isQuickComplete = await phaseService.isPhaseComplete('quick', quickAnswered, 'S1');
    console.log(`✅ Quick phase complete: ${isQuickComplete}`);
    console.log('');

    // Test 6: Progress calculation for quick phase
    console.log('📋 Test 6: Progress calculation for quick phase');
    const progress = await adaptiveQuestioning.getProgress(flowState, 'S1');
    console.log(`✅ Progress: ${progress}%`);
    console.log('');

    // Test 7: Filter questions by phase
    console.log('📋 Test 7: Filter questions by phase and category');
    const governanceQuick = await questionService.getQuestions({
      category: 'governance',
      phase: 'quick',
      ifrsStandard: 'S1',
      isActive: true,
    });
    console.log(`✅ Found ${governanceQuick.length} governance questions in quick phase`);
    console.log('');

    console.log('✅ All phase tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testPhaseSystem()
  .then(() => {
    console.log('\n🎉 Phase system testing completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
