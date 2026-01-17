import { QuestionService } from '../services/question/questionService';
import { AdaptiveQuestioning } from '../services/question/adaptiveQuestioning';
import { QuestionTemplateService } from '../services/question/questionTemplates';

async function testQuestionSystem() {
  console.log('🧪 Testing Question System...\n');

  const questionService = new QuestionService();
  const adaptiveQuestioning = new AdaptiveQuestioning(questionService);
  const templateService = new QuestionTemplateService();

  try {
    // Test 1: Get all categories
    console.log('📋 Test 1: Get all categories');
    const categories = await questionService.getCategories();
    console.log(`✅ Found ${categories.length} categories:`, categories.map(c => c.name).join(', '));
    console.log('');

    // Test 2: Get all questions
    console.log('📋 Test 2: Get all questions');
    const allQuestions = await questionService.getQuestions();
    console.log(`✅ Found ${allQuestions.length} total questions`);
    console.log('');

    // Test 3: Get questions by category
    console.log('📋 Test 3: Get questions by category (governance)');
    const governanceQuestions = await questionService.getQuestionsByCategory('governance');
    console.log(`✅ Found ${governanceQuestions.length} governance questions`);
    if (governanceQuestions.length > 0) {
      console.log(`   Sample: ${governanceQuestions[0].text.substring(0, 60)}...`);
    }
    console.log('');

    // Test 4: Get questions by IFRS standard
    console.log('📋 Test 4: Get questions by IFRS standard (S1)');
    const s1Questions = await questionService.getQuestionsByStandard('S1');
    console.log(`✅ Found ${s1Questions.length} IFRS S1 questions`);
    console.log('');

    console.log('📋 Test 4b: Get questions by IFRS standard (S2)');
    const s2Questions = await questionService.getQuestionsByStandard('S2');
    console.log(`✅ Found ${s2Questions.length} IFRS S2 questions`);
    console.log('');

    // Test 5: Get single question by ID
    console.log('📋 Test 5: Get question by ID');
    if (allQuestions.length > 0) {
      const question = await questionService.getQuestionById(allQuestions[0].id);
      if (question) {
        console.log(`✅ Found question: ${question.text.substring(0, 60)}...`);
        console.log(`   Category: ${question.category.name}`);
        console.log(`   IFRS Standard: ${question.ifrsStandard}`);
        console.log(`   Weight: ${question.weight}`);
      }
    }
    console.log('');

    // Test 6: Adaptive questioning - get next question
    console.log('📋 Test 6: Adaptive questioning - get next question');
    const flowState = {
      answeredQuestions: new Set<string>(),
      answeredAnswers: [],
    };
    const nextQuestion = await adaptiveQuestioning.getNextQuestion(flowState, 'S1');
    if (nextQuestion) {
      console.log(`✅ Next question: ${nextQuestion.text.substring(0, 60)}...`);
      console.log(`   Category: ${nextQuestion.category.name}`);
    }
    console.log('');

    // Test 7: Adaptive questioning - progress
    console.log('📋 Test 7: Adaptive questioning - progress calculation');
    const progress = await adaptiveQuestioning.getProgress(flowState, 'S1');
    console.log(`✅ Progress: ${progress}%`);
    console.log('');

    // Test 8: Question templates - format for chat
    console.log('📋 Test 8: Question templates - format for chat');
    if (allQuestions.length > 0) {
      const formatted = templateService.formatQuestionForChat(allQuestions[0]);
      console.log(`✅ Formatted question:\n${formatted.substring(0, 150)}...`);
    }
    console.log('');

    // Test 9: Question templates - format for AI
    console.log('📋 Test 9: Question templates - format for AI');
    if (allQuestions.length > 0) {
      const aiFormatted = templateService.formatQuestionForAI(allQuestions[0]);
      console.log(`✅ AI formatted question:\n${aiFormatted.substring(0, 150)}...`);
    }
    console.log('');

    // Test 10: Filter questions
    console.log('📋 Test 10: Filter questions by category and standard');
    const filtered = await questionService.getQuestions({
      category: 'strategy',
      ifrsStandard: 'S1',
      isActive: true,
    });
    console.log(`✅ Found ${filtered.length} active strategy questions for IFRS S1`);
    console.log('');

    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testQuestionSystem()
  .then(() => {
    console.log('\n🎉 Question system testing completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
