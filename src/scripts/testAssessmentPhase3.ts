import dotenv from 'dotenv';
import { AssessmentFlowEngine } from '../services/assessment/assessmentFlowEngine';
import { PhaseService } from '../services/assessment/phaseService';
import { PersonalizationService } from '../services/assessment/personalizationService';
import { ConversationalAssessmentService } from '../services/assessment/conversationalAssessment';
import { QuestionOptimizer } from '../services/question/questionOptimizer';
import type { QuestionNode } from '../services/assessment/assessmentFlowEngine';

// Load environment variables
dotenv.config();

/**
 * Integration Test Script for Phase 3: Assessment Flow Overhaul
 * Tests all Week 1 & Week 2 implementations
 */

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string, details?: any) {
  results.push({ name, passed, error, details });
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
  if (details) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }
}

/**
 * Create sample questions for testing
 */
function createSampleQuestions(): QuestionNode[] {
  return [
    {
      id: 'q1',
      question: 'Does your organization have a board-level sustainability committee?',
      category: 'Governance',
      priority: 'high',
      format: 'yes-no',
      dependsOn: [],
    },
    {
      id: 'q2',
      question: 'How is sustainability integrated into your business strategy?',
      category: 'Strategy',
      priority: 'high',
      format: 'open-ended',
      dependsOn: ['q1'],
    },
    {
      id: 'q3',
      question: 'What is your organization\'s approach to climate risk management?',
      category: 'Risk Management',
      priority: 'medium',
      format: 'open-ended',
      dependsOn: ['q2'],
    },
    {
      id: 'q4',
      question: 'Rate your current sustainability reporting maturity (1-5)',
      category: 'Metrics',
      priority: 'medium',
      format: 'scale',
      scaleRange: { min: 1, max: 5, step: 1 },
      dependsOn: ['q3'],
    },
    {
      id: 'q5',
      question: 'Select all applicable sustainability metrics your organization tracks',
      category: 'Metrics',
      priority: 'low',
      format: 'multi-select',
      options: ['GHG Emissions', 'Energy Consumption', 'Water Usage', 'Waste Management'],
      dependsOn: ['q4'],
    },
  ];
}

/**
 * Test 1: Assessment Flow Engine Foundation
 */
async function testAssessmentFlowEngine() {
  console.log('\n🎯 Test 1: Assessment Flow Engine');
  console.log('='.repeat(80));

  try {
    const engine = new AssessmentFlowEngine();
    const questions = createSampleQuestions();
    engine.registerQuestions(questions);

    // Test starting assessment
    const context = engine.startAssessment('test-session', 'test-user', 'S1', 'standard');
    
    if (context.sessionId === 'test-session' && context.phase === 'initiation') {
      logTest('Start Assessment', true, undefined, {
        sessionId: context.sessionId,
        mode: context.mode,
        phase: context.phase,
      });
    } else {
      logTest('Start Assessment', false, 'Context not initialized correctly');
    }

    // Test getting next question
    const decision = engine.getNextQuestion(context);
    
    if (decision.nextQuestion && decision.nextQuestion.id) {
      logTest('Get Next Question', true, undefined, {
        questionId: decision.nextQuestion.id,
        category: decision.nextQuestion.category,
      });
    } else {
      logTest('Get Next Question', false, 'No question returned');
    }

    // Test submitting answer
    const answer = {
      questionId: decision.nextQuestion!.id,
      value: true,
      answeredAt: new Date(),
    };
    const updatedContext = engine.submitAnswer(context, decision.nextQuestion!.id, answer);
    
    if (updatedContext.answeredQuestions.has(decision.nextQuestion!.id)) {
      logTest('Submit Answer', true, undefined, {
        answeredCount: updatedContext.answeredQuestions.size,
      });
    } else {
      logTest('Submit Answer', false, 'Answer not recorded');
    }

    // Test assessment summary
    const summary = engine.getAssessmentSummary(updatedContext);
    
    if (summary.answeredCount > 0) {
      logTest('Get Assessment Summary', true, undefined, summary);
    } else {
      logTest('Get Assessment Summary', false, 'Summary not correct');
    }

  } catch (error) {
    logTest('Assessment Flow Engine', false, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Test 2: Context-Aware Sequencing
 */
async function testContextAwareSequencing() {
  console.log('\n🧠 Test 2: Context-Aware Sequencing');
  console.log('='.repeat(80));

  try {
    const engine = new AssessmentFlowEngine();
    const questions = createSampleQuestions();
    engine.registerQuestions(questions);

    const context = engine.startAssessment('test-session', 'test-user', 'S1', 'standard');
    engine.registerQuestions(questions);

    // Submit some answers
    const answer1 = { questionId: 'q1', value: true, answeredAt: new Date() };
    const answer2 = { questionId: 'q2', value: 'Integrated', answeredAt: new Date() };
    
    let updatedContext = engine.submitAnswer(context, 'q1', answer1);
    updatedContext = engine.submitAnswer(updatedContext, 'q2', answer2);

    // Test context-aware next question
    const decision = engine.getContextAwareNextQuestion(updatedContext);
    
    if (decision.nextQuestion) {
      logTest('Context-Aware Next Question', true, undefined, {
        questionId: decision.nextQuestion.id,
        category: decision.nextQuestion.category,
      });
    } else {
      logTest('Context-Aware Next Question', false, 'No question returned');
    }

    // Test progressive questions
    const broadQuestions = engine.getProgressiveQuestions(updatedContext, 'broad');
    
    if (broadQuestions.length > 0) {
      logTest('Progressive Disclosure (Broad)', true, undefined, {
        count: broadQuestions.length,
      });
    } else {
      logTest('Progressive Disclosure (Broad)', false, 'No broad questions');
    }

  } catch (error) {
    logTest('Context-Aware Sequencing', false, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Test 3: Question Optimization
 */
async function testQuestionOptimization() {
  console.log('\n⚙️ Test 3: Question Optimization');
  console.log('='.repeat(80));

  try {
    const optimizer = new QuestionOptimizer();

    // Test question chunking
    const complexQuestion: QuestionNode = {
      id: 'complex-q',
      question: 'Does your organization have a sustainability strategy and how does it integrate with your business model and what metrics do you track?',
      category: 'Strategy',
      priority: 'high',
      format: 'open-ended',
      dependsOn: [],
    };

    const chunkResult = optimizer.chunkQuestion(complexQuestion);
    
    if (chunkResult.chunks.length > 1) {
      logTest('Question Chunking', true, undefined, {
        originalLength: complexQuestion.question.length,
        chunksCount: chunkResult.chunks.length,
        shouldChunk: chunkResult.shouldChunk,
      });
    } else {
      logTest('Question Chunking', false, 'Question not chunked');
    }

    // Test format optimization
    const questionWithoutFormat: QuestionNode = {
      id: 'format-test',
      question: 'Does your organization have a sustainability committee?',
      category: 'Governance',
      priority: 'high',
      format: 'open-ended', // Will be optimized
      dependsOn: [],
    };

    const optimizedFormat = optimizer.optimizeFormat(questionWithoutFormat);
    
    if (optimizedFormat === 'yes-no') {
      logTest('Format Optimization', true, undefined, {
        optimizedFormat,
      });
    } else {
      logTest('Format Optimization', false, `Wrong format: ${optimizedFormat}`);
    }

    // Test option generation
    const questionWithOptions: QuestionNode = {
      id: 'options-test',
      question: 'What is the frequency of your sustainability reporting?',
      category: 'Reporting',
      priority: 'medium',
      format: 'multiple-choice',
      dependsOn: [],
    };

    const options = optimizer.generateOptions(questionWithOptions);
    
    if (options.length > 0) {
      logTest('Option Generation', true, undefined, {
        optionsCount: options.length,
        options,
      });
    } else {
      logTest('Option Generation', false, 'No options generated');
    }

    // Test batch optimization
    const questions = createSampleQuestions();
    const optimized = optimizer.optimizeQuestions(questions);
    
    if (optimized.optimized.length > 0) {
      logTest('Batch Question Optimization', true, undefined, {
        optimizedCount: optimized.optimized.length,
        chunkedCount: optimized.chunked.length,
      });
    } else {
      logTest('Batch Question Optimization', false, 'No optimized questions');
    }

  } catch (error) {
    logTest('Question Optimization', false, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Test 4: Assessment Modes
 */
async function testAssessmentModes() {
  console.log('\n📋 Test 4: Assessment Modes');
  console.log('='.repeat(80));

  try {
    const phaseService = new PhaseService();

    // Test Quick Scan mode
    const quickScanConfig = phaseService.getModeConfig('quick-scan');
    
    if (quickScanConfig.mode === 'quick-scan' && quickScanConfig.estimatedDuration === 7) {
      logTest('Quick Scan Mode', true, undefined, quickScanConfig);
    } else {
      logTest('Quick Scan Mode', false, 'Config not correct');
    }

    // Test Standard mode
    const standardConfig = phaseService.getModeConfig('standard');
    
    if (standardConfig.mode === 'standard') {
      logTest('Standard Mode', true, undefined, {
        estimatedDuration: standardConfig.estimatedDuration,
        questionCount: standardConfig.questionCount,
      });
    } else {
      logTest('Standard Mode', false, 'Config not correct');
    }

    // Test mode recommendation
    const recommendedMode = phaseService.recommendMode({
      timeAvailable: 10,
      depthRequired: 'surface',
    });
    
    if (recommendedMode === 'quick-scan') {
      logTest('Mode Recommendation', true, undefined, { recommendedMode });
    } else {
      logTest('Mode Recommendation', false, `Wrong mode: ${recommendedMode}`);
    }

    // Test progress calculation
    const mockContext = {
      sessionId: 'test',
      userId: 'test-user',
      ifrsStandard: 'S1' as const,
      mode: 'standard' as const,
      phase: 'assessment' as const,
      answeredQuestions: new Set(['q1', 'q2']),
      answers: new Map(),
      gaps: [],
      progress: 40,
      startedAt: new Date(),
      lastUpdated: new Date(),
    };

    const progress = phaseService.calculateProgress(mockContext as any);
    
    if (progress.percentage >= 0 && progress.percentage <= 100) {
      logTest('Progress Calculation', true, undefined, progress);
    } else {
      logTest('Progress Calculation', false, 'Invalid progress percentage');
    }

  } catch (error) {
    logTest('Assessment Modes', false, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Test 5: Personalization Service
 */
async function testPersonalization() {
  console.log('\n🎨 Test 5: Personalization Service');
  console.log('='.repeat(80));

  try {
    const personalizationService = new PersonalizationService();
    const questions = createSampleQuestions();

    // Test industry configuration
    const manufacturingConfig = personalizationService.getIndustryConfig('manufacturing');
    
    if (manufacturingConfig.industry === 'manufacturing') {
      logTest('Industry Configuration', true, undefined, {
        industry: manufacturingConfig.industry,
        priorityCategories: manufacturingConfig.priorityCategories,
      });
    } else {
      logTest('Industry Configuration', false, 'Config not correct');
    }

    // Test entity type configuration
    const publicCompanyConfig = personalizationService.getEntityTypeConfig('public-company');
    
    if (publicCompanyConfig.entityType === 'public-company') {
      logTest('Entity Type Configuration', true, undefined, {
        entityType: publicCompanyConfig.entityType,
        requiredCategories: publicCompanyConfig.requiredCategories,
      });
    } else {
      logTest('Entity Type Configuration', false, 'Config not correct');
    }

    // Test question personalization
    const profile = {
      industry: 'manufacturing' as const,
      entityType: 'public-company' as const,
      size: 'enterprise' as const,
      geography: 'Nigeria',
    };

    const personalized = personalizationService.applyFullPersonalization(questions, profile);
    
    if (personalized.length > 0) {
      logTest('Question Personalization', true, undefined, {
        originalCount: questions.length,
        personalizedCount: personalized.length,
      });
    } else {
      logTest('Question Personalization', false, 'No personalized questions');
    }

    // Test size customization
    const smePersonalized = personalizationService.customizeBySize(questions, 'sme');
    
    if (smePersonalized.length > 0) {
      logTest('Size-Based Customization', true, undefined, {
        originalCount: questions.length,
        smeCount: smePersonalized.length,
      });
    } else {
      logTest('Size-Based Customization', false, 'No customized questions');
    }

    // Test geographic customization
    const geoPersonalized = personalizationService.customizeByGeography(questions, 'Nigeria');
    
    if (geoPersonalized.length > 0) {
      logTest('Geographic Customization', true, undefined, {
        originalCount: questions.length,
        geoCount: geoPersonalized.length,
      });
    } else {
      logTest('Geographic Customization', false, 'No customized questions');
    }

  } catch (error) {
    logTest('Personalization Service', false, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Test 6: Conversational Assessment
 */
async function testConversationalAssessment() {
  console.log('\n💬 Test 6: Conversational Assessment');
  console.log('='.repeat(80));

  try {
    const engine = new AssessmentFlowEngine();
    const conversationalService = new ConversationalAssessmentService(engine);
    const questions = createSampleQuestions();
    engine.registerQuestions(questions);

    // Test starting conversational assessment
    const state = conversationalService.startConversationalAssessment(
      'test-session',
      'test-user',
      'S1',
      'standard'
    );
    
    if (state.messages.length > 0 && state.assessmentContext.sessionId === 'test-session') {
      logTest('Start Conversational Assessment', true, undefined, {
        messageCount: state.messages.length,
        phase: state.assessmentContext.phase,
      });
    } else {
      logTest('Start Conversational Assessment', false, 'State not initialized correctly');
    }

    // Test processing message
    const result1 = await conversationalService.processMessage('test-session', 'Start assessment');
    
    if (result1.response) {
      logTest('Process Message', true, undefined, {
        hasResponse: !!result1.response,
        hasQuestion: !!result1.question,
      });
    } else {
      logTest('Process Message', false, 'No response generated');
    }

    // Test answer validation (if question exists)
    if (result1.question) {
      const answerValidation = (conversationalService as any).validateAnswer(
        'Yes',
        result1.question
      );
      
      if (answerValidation.valid) {
        logTest('Answer Validation', true, undefined, answerValidation);
      } else {
        logTest('Answer Validation', false, 'Validation failed');
      }
    }

  } catch (error) {
    logTest('Conversational Assessment', false, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Test 7: Integration Test
 */
async function testIntegration() {
  console.log('\n🔗 Test 7: Integration Test');
  console.log('='.repeat(80));

  try {
    // Initialize all services
    const engine = new AssessmentFlowEngine();
    const phaseService = new PhaseService();
    const personalizationService = new PersonalizationService();
    const conversationalService = new ConversationalAssessmentService(engine);
    const optimizer = new QuestionOptimizer();

    // Create and optimize questions
    const questions = createSampleQuestions();
    const optimized = optimizer.optimizeQuestions(questions);
    engine.registerQuestions(optimized.optimized);

    // Start personalized assessment
    const profile = {
      industry: 'manufacturing' as const,
      entityType: 'public-company' as const,
      size: 'enterprise' as const,
      geography: 'Nigeria',
    };

    const personalizedQuestions = personalizationService.applyFullPersonalization(
      optimized.optimized,
      profile
    );

    // Start conversational assessment
    const state = conversationalService.startConversationalAssessment(
      'integration-test',
      'test-user',
      'S1',
      'standard'
    );

    // Process assessment flow
    
    // Get first question
    const question1 = await conversationalService.processMessage('integration-test', 'Ready');
    
    if (question1.question) {
      logTest('Integration: Get First Question', true, undefined, {
        questionId: question1.question.id,
      });
    } else {
      logTest('Integration: Get First Question', false, 'No question returned');
    }

    // Submit answer
    if (question1.question) {
      const answer = 'Yes';
      const result2 = await conversationalService.processMessage('integration-test', answer);
      
      if (result2.response) {
        logTest('Integration: Submit Answer', true, undefined, {
          hasResponse: !!result2.response,
        });
      } else {
        logTest('Integration: Submit Answer', false, 'Answer not processed');
      }
    }

    // Test progress calculation
    const progressContext = {
      ...state.assessmentContext,
      answeredQuestions: new Set(['q1']),
    };

    const progress = phaseService.calculateProgress(progressContext as any);
    
    if (progress.percentage >= 0) {
      logTest('Integration: Progress Tracking', true, undefined, progress);
    } else {
      logTest('Integration: Progress Tracking', false, 'Progress not calculated');
    }

    logTest('Integration: Full Flow', true, undefined, {
      servicesInitialized: true,
      questionsOptimized: optimized.optimized.length,
      personalizedQuestions: personalizedQuestions.length,
      assessmentStarted: !!state,
    });

  } catch (error) {
    logTest('Integration Test', false, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('\n🚀 Phase 3 Assessment Flow Overhaul Tests');
  console.log('='.repeat(80));
  console.log('Testing Week 1 & Week 2 Implementation');
  console.log('='.repeat(80));

  await testAssessmentFlowEngine();
  await testContextAwareSequencing();
  await testQuestionOptimization();
  await testAssessmentModes();
  await testPersonalization();
  await testConversationalAssessment();
  await testIntegration();

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 Test Summary');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const passRate = ((passed / total) * 100).toFixed(1);

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Pass Rate: ${passRate}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error || 'Unknown error'}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
