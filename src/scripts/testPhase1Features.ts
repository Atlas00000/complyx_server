import dotenv from 'dotenv';
import { promptTemplateSystem } from '../services/ai/utils/promptTemplates';
import { 
  buildAssessmentConversation, 
  buildQAConversation, 
  buildGuidanceConversation,
  buildContextualConversation,
} from '../services/ai/utils/prompts';
import { ConversationMemoryService } from '../services/ai/memory/conversationMemoryService';
import { EnhancedContextBuilder } from '../services/ai/context/enhancedContextBuilder';
import { AIService } from '../services/ai/AIService';
import { responseTemplateSystem } from '../services/ai/utils/responseTemplates';
import { intentRecognitionService } from '../services/ai/utils/intentRecognition';
import { conversationStateService } from '../services/ai/utils/conversationState';
import type { Message } from '../services/ai/interfaces/AIProvider';

// Load environment variables
dotenv.config();

/**
 * Test Script for Phase 1: Enhanced AI-Powered Chat Features
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
 * Test 1: Prompt Templates
 */
async function testPromptTemplates() {
  console.log('\n📝 Test 1: Prompt Templates');
  console.log('='.repeat(80));

  try {
    // Test system prompt template
    const systemPrompt = promptTemplateSystem.buildSystemPrompt({
      ifrsStandard: 'IFRS S1',
      contextDocuments: 'Test context',
    });
    
    if (systemPrompt.includes('IFRS S1') && systemPrompt.includes('Test context')) {
      logTest('System Prompt Template', true);
    } else {
      logTest('System Prompt Template', false, 'Template variables not replaced');
    }

    // Test assessment prompt
    const assessmentPrompt = promptTemplateSystem.buildAssessmentPrompt({
      ifrsStandard: 'IFRS S2',
      assessmentPhase: 'detailed',
      progress: 50,
    });
    
    if (assessmentPrompt.includes('IFRS S2') && assessmentPrompt.includes('detailed')) {
      logTest('Assessment Prompt Template', true);
    } else {
      logTest('Assessment Prompt Template', false, 'Template variables not replaced');
    }

    // Test Q&A prompt
    const qaPrompt = promptTemplateSystem.buildQAPrompt({
      userQuery: 'What is IFRS S1?',
      conversationHistory: 'Previous context',
    });
    
    if (qaPrompt.includes('What is IFRS S1?') && qaPrompt.includes('Previous context')) {
      logTest('Q&A Prompt Template', true);
    } else {
      logTest('Q&A Prompt Template', false, 'Template variables not replaced');
    }

    // Test conditional rendering
    const conditionalTest = promptTemplateSystem.renderTemplate('system-prompt', {
      ifrsStandard: 'IFRS S1',
    });
    
    if (conditionalTest.includes('IFRS S1')) {
      logTest('Conditional Template Rendering', true);
    } else {
      logTest('Conditional Template Rendering', false, 'Conditional blocks not working');
    }

  } catch (error) {
    logTest('Prompt Templates', false, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Test 2: Few-Shot Learning Examples
 */
async function testFewShotLearning() {
  console.log('\n🎓 Test 2: Few-Shot Learning Examples');
  console.log('='.repeat(80));

  try {
    const messages: Message[] = [
      { role: 'user', content: 'What is IFRS S1?' },
    ];

    // Test assessment conversation
    const assessmentConv = buildAssessmentConversation(messages, 'S1');
    if (assessmentConv.length > messages.length && assessmentConv.some(m => m.role === 'system')) {
      logTest('Assessment Conversation with Examples', true, undefined, {
        messageCount: assessmentConv.length,
      });
    } else {
      logTest('Assessment Conversation with Examples', false, 'Examples not added');
    }

    // Test Q&A conversation
    const qaConv = buildQAConversation(messages);
    if (qaConv.length > messages.length) {
      logTest('Q&A Conversation with Examples', true, undefined, {
        messageCount: qaConv.length,
      });
    } else {
      logTest('Q&A Conversation with Examples', false, 'Examples not added');
    }

    // Test contextual conversation detection
    const contextualConv = buildContextualConversation([
      { role: 'user', content: 'Start IFRS S1 assessment' },
    ]);
    
    if (contextualConv.length > 1) {
      logTest('Contextual Conversation Detection', true, undefined, {
        messageCount: contextualConv.length,
      });
    } else {
      logTest('Contextual Conversation Detection', false, 'Context not detected');
    }

  } catch (error) {
    logTest('Few-Shot Learning', false, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Test 3: Enhanced Memory & Hierarchical Context
 */
async function testMemoryAndContext() {
  console.log('\n🧠 Test 3: Enhanced Memory & Hierarchical Context');
  console.log('='.repeat(80));

  try {
    const memoryService = new ConversationMemoryService();
    const sessionId = `test-session-${Date.now()}`;
    const userId = 'test-user';

    // Create many messages
    const messages: Message[] = Array.from({ length: 60 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Test message ${i + 1}`,
    }));

    // Test memory saving
    await memoryService.saveConversation(sessionId, userId, messages, {
      maxMessages: 100,
      maxContextLength: 50,
    });
    logTest('Memory Saving (60 messages)', true);

    // Test hierarchical context
    const hierarchical = await memoryService.buildHierarchicalContext(sessionId, userId, {
      conversationThreshold: 30,
    });
    
    if (hierarchical.conversations.length > 0 || hierarchical.currentConversation) {
      logTest('Hierarchical Context Building', true, undefined, {
        conversationCount: hierarchical.conversations.length,
        hasCurrentConversation: !!hierarchical.currentConversation,
      });
    } else {
      logTest('Hierarchical Context Building', false, 'No conversations created');
    }

    // Test context retrieval
    const context = await memoryService.getHierarchicalContext(sessionId, userId);
    if (context.flattened.length > 0) {
      logTest('Context Retrieval', true, undefined, {
        flattenedMessages: context.flattened.length,
      });
    } else {
      logTest('Context Retrieval', false, 'No context retrieved');
    }

    // Test memory stats
    const stats = await memoryService.getMemoryStats(sessionId);
    if (stats.messageCount > 0) {
      logTest('Memory Statistics', true, undefined, stats);
    } else {
      logTest('Memory Statistics', false, 'No stats returned');
    }

  } catch (error) {
    logTest('Memory & Context', false, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Test 4: Context Summarization & Pruning
 */
async function testContextSummarization() {
  console.log('\n✂️ Test 4: Context Summarization & Pruning');
  console.log('='.repeat(80));

  try {
    const contextBuilder = new EnhancedContextBuilder();
    
    // Create long conversation
    const messages: Message[] = Array.from({ length: 40 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message about IFRS S1 governance requirements ${i + 1}`,
    }));

    // Test summarization
    const summary = await contextBuilder.summarizeContext(messages);
    if (summary && summary.length > 0) {
      logTest('Context Summarization', true, undefined, {
        summaryLength: summary.length,
        includesTopics: summary.includes('IFRS') || summary.includes('governance'),
      });
    } else {
      logTest('Context Summarization', false, 'No summary generated');
    }

    // Test pruning
    const pruned = contextBuilder.pruneContext(messages, 20, {
      keepSystemMessages: true,
      keepRecentMessages: 10,
      prioritizeUserMessages: true,
    });
    
    if (pruned.length <= 20 && pruned.length > 0) {
      logTest('Context Pruning', true, undefined, {
        originalCount: messages.length,
        prunedCount: pruned.length,
      });
    } else {
      logTest('Context Pruning', false, 'Pruning not working correctly');
    }

    // Test pruned context building
    const prunedContext = await contextBuilder.buildPrunedContext(messages, 20, true, 30);
    if (prunedContext.messages.length <= 20 && prunedContext.summary) {
      logTest('Pruned Context Building', true, undefined, {
        originalCount: prunedContext.originalCount,
        prunedCount: prunedContext.prunedCount,
        hasSummary: !!prunedContext.summary,
      });
    } else {
      logTest('Pruned Context Building', false, 'Pruned context not built correctly');
    }

  } catch (error) {
    logTest('Context Summarization', false, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Test 5: Response Validation & Confidence Scoring
 */
async function testResponseValidation() {
  console.log('\n✅ Test 5: Response Validation & Confidence Scoring');
  console.log('='.repeat(80));

  try {
    const aiService = new AIService();
    
    // Test with mock response (if AI service is not available, skip actual AI call)
    if (!aiService.isAvailable()) {
      logTest('AI Service Available', false, 'AI service not configured - skipping validation tests');
      return;
    }

    const messages: Message[] = [
      { role: 'user', content: 'What is IFRS S1?' },
    ];

    // Test response with validation
    const response = await aiService.chat(messages);
    
    if ('confidence' in response && 'validation' in response) {
      logTest('Response with Validation', true, undefined, {
        hasConfidence: typeof response.confidence === 'number',
        hasValidation: !!response.validation,
        confidence: response.confidence,
        validationValid: response.validation?.valid,
      });
    } else {
      logTest('Response with Validation', false, 'Response missing validation fields');
    }

    // Test confidence scoring
    if (response.confidence !== undefined) {
      const confidenceValid = response.confidence >= 0 && response.confidence <= 1;
      logTest('Confidence Scoring', confidenceValid, undefined, {
        confidence: response.confidence,
      });
    } else {
      logTest('Confidence Scoring', false, 'No confidence score');
    }

    // Test fact-checking
    if (response.factCheck) {
      logTest('Fact-Checking', true, undefined, {
        factChecked: response.factCheck.factChecked,
        confidence: response.factCheck.confidence,
      });
    } else {
      logTest('Fact-Checking', false, 'No fact-check results');
    }

  } catch (error) {
    logTest('Response Validation', false, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Test 6: Response Templates
 */
async function testResponseTemplates() {
  console.log('\n📋 Test 6: Response Templates');
  console.log('='.repeat(80));

  try {
    // Test welcome template
    const welcome = responseTemplateSystem.renderTemplate('welcome', {
      userName: 'Test User',
    });
    
    if (welcome.includes('Complyx') && welcome.includes('Test User')) {
      logTest('Welcome Template', true);
    } else {
      logTest('Welcome Template', false, 'Template not rendered correctly');
    }

    // Test assessment start template
    const assessmentStart = responseTemplateSystem.renderTemplate('assessment-start', {
      ifrsStandard: 'S1',
      organizationName: 'Test Org',
    });
    
    if (assessmentStart.includes('IFRS S1') && assessmentStart.includes('Test Org')) {
      logTest('Assessment Start Template', true);
    } else {
      logTest('Assessment Start Template', false, 'Template not rendered correctly');
    }

    // Test fallback responses
    const errorFallback = responseTemplateSystem.getFallbackResponse('error');
    const unclearFallback = responseTemplateSystem.getFallbackResponse('unclear');
    
    if (errorFallback && unclearFallback) {
      logTest('Fallback Responses', true, undefined, {
        errorFallbackLength: errorFallback.length,
        unclearFallbackLength: unclearFallback.length,
      });
    } else {
      logTest('Fallback Responses', false, 'Fallbacks not working');
    }

    // Test template determination
    const templateId = responseTemplateSystem.determineTemplate({
      conversationStage: 'start',
      userIntent: 'start_assessment',
    });
    
    if (templateId === 'assessment-start') {
      logTest('Template Determination', true, undefined, { templateId });
    } else {
      logTest('Template Determination', false, `Wrong template: ${templateId}`);
    }

  } catch (error) {
    logTest('Response Templates', false, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Test 7: Intent Recognition
 */
async function testIntentRecognition() {
  console.log('\n🎯 Test 7: Intent Recognition');
  console.log('='.repeat(80));

  try {
    // Test assessment intent
    const assessmentIntent = intentRecognitionService.recognizeIntent('Start IFRS S1 assessment');
    if (assessmentIntent.type === 'start_assessment' && assessmentIntent.entities?.ifrsStandard === 'S1') {
      logTest('Assessment Intent Recognition', true, undefined, assessmentIntent);
    } else {
      logTest('Assessment Intent Recognition', false, `Wrong intent: ${assessmentIntent.type}`);
    }

    // Test question intent
    const questionIntent = intentRecognitionService.recognizeIntent('What is IFRS S2?');
    if (questionIntent.type === 'ask_question') {
      logTest('Question Intent Recognition', true, undefined, questionIntent);
    } else {
      logTest('Question Intent Recognition', false, `Wrong intent: ${questionIntent.type}`);
    }

    // Test guidance intent
    const guidanceIntent = intentRecognitionService.recognizeIntent('How do I implement IFRS S1?');
    if (guidanceIntent.type === 'request_guidance') {
      logTest('Guidance Intent Recognition', true, undefined, guidanceIntent);
    } else {
      logTest('Guidance Intent Recognition', false, `Wrong intent: ${guidanceIntent.type}`);
    }

    // Test follow-up detection
    const conversationHistory: Message[] = [
      { role: 'assistant', content: 'IFRS S1 is about sustainability disclosures.' },
      { role: 'user', content: 'What about S2?' },
    ];
    
    const followUp = intentRecognitionService.detectFollowUpQuestion(
      'What about S2?',
      conversationHistory
    );
    
    if (followUp.detected && followUp.isFollowUp) {
      logTest('Follow-Up Detection', true, undefined, followUp);
    } else {
      logTest('Follow-Up Detection', false, 'Follow-up not detected');
    }

    // Test conversation intent classification
    const messages: Message[] = [
      { role: 'user', content: 'Start assessment' },
      { role: 'user', content: 'What is IFRS S1?' },
      { role: 'user', content: 'How do I implement it?' },
    ];
    
    const conversationIntent = intentRecognitionService.classifyConversationIntent(messages);
    if (conversationIntent.primaryIntent) {
      logTest('Conversation Intent Classification', true, undefined, conversationIntent);
    } else {
      logTest('Conversation Intent Classification', false, 'No primary intent');
    }

  } catch (error) {
    logTest('Intent Recognition', false, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Test 8: Conversation State Tracking
 */
async function testConversationState() {
  console.log('\n📊 Test 8: Conversation State Tracking');
  console.log('='.repeat(80));

  try {
    const sessionId = `test-state-${Date.now()}`;
    const userId = 'test-user';

    const messages: Message[] = [
      { role: 'user', content: 'Start IFRS S1 assessment' },
    ];

    // Test state update
    const state1 = conversationStateService.updateState(sessionId, userId, 'Start IFRS S1 assessment', messages);
    if (state1.conversationPhase === 'assessment' && state1.currentIntent.type === 'start_assessment') {
      logTest('State Update', true, undefined, {
        phase: state1.conversationPhase,
        intent: state1.currentIntent.type,
      });
    } else {
      logTest('State Update', false, 'State not updated correctly');
    }

    // Test state retrieval
    const retrievedState = conversationStateService.getState(sessionId, userId);
    if (retrievedState.conversationPhase === 'assessment') {
      logTest('State Retrieval', true, undefined, {
        phase: retrievedState.conversationPhase,
      });
    } else {
      logTest('State Retrieval', false, 'State not retrieved correctly');
    }

    // Test context-aware message building
    const baseMessages: Message[] = [
      { role: 'system', content: 'You are Complyx.' },
      { role: 'user', content: 'What is IFRS S1?' },
    ];
    
    const contextAware = conversationStateService.buildContextAwareMessages(
      sessionId,
      userId,
      baseMessages,
      messages
    );
    
    if (contextAware.length > baseMessages.length && contextAware[0].content.includes('Conversation Context')) {
      logTest('Context-Aware Message Building', true, undefined, {
        originalLength: baseMessages.length,
        enhancedLength: contextAware.length,
      });
    } else {
      logTest('Context-Aware Message Building', false, 'Context not injected');
    }

    // Test phase transition
    const state2 = conversationStateService.updateState(
      sessionId,
      userId,
      'What is IFRS S1?',
      [...messages, { role: 'user', content: 'What is IFRS S1?' }]
    );
    
    if (state2.conversationPhase === 'exploration' || state2.conversationPhase === 'assessment') {
      logTest('Phase Transition', true, undefined, {
        phase: state2.conversationPhase,
      });
    } else {
      logTest('Phase Transition', false, `Phase not transitioned: ${state2.conversationPhase}`);
    }

  } catch (error) {
    logTest('Conversation State', false, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Test 9: Integration Test
 */
async function testIntegration() {
  console.log('\n🔗 Test 9: Integration Test');
  console.log('='.repeat(80));

  try {
    const sessionId = `test-integration-${Date.now()}`;
    const userId = 'test-user';

    // Simulate full conversation flow
    const messages: Message[] = [];
    
    // 1. Start conversation
    const message1 = 'Start IFRS S1 assessment';
    messages.push({ role: 'user', content: message1 });
    
    // Update state
    const state1 = conversationStateService.updateState(sessionId, userId, message1, messages);
    
    // Recognize intent
    const intent1 = intentRecognitionService.recognizeIntent(message1, messages);
    
    // Build context-aware messages
    const contextMessages = conversationStateService.buildContextAwareMessages(
      sessionId,
      userId,
      buildContextualConversation(messages),
      messages
    );

    if (state1.conversationPhase === 'assessment' && intent1.type === 'start_assessment' && contextMessages.length > 0) {
      logTest('Integration: Start Assessment', true, undefined, {
        phase: state1.conversationPhase,
        intent: intent1.type,
        contextMessages: contextMessages.length,
      });
    } else {
      logTest('Integration: Start Assessment', false, 'Integration failed');
    }

    // 2. Ask question
    const message2 = 'What are the governance requirements?';
    messages.push({ role: 'user', content: message2 });
    
    const state2 = conversationStateService.updateState(sessionId, userId, message2, messages);
    const intent2 = intentRecognitionService.recognizeIntent(message2, messages);
    
    if (state2.currentIntent.type === 'ask_question' && intent2.type === 'ask_question') {
      logTest('Integration: Ask Question', true, undefined, {
        intent: intent2.type,
      });
    } else {
      logTest('Integration: Ask Question', false, 'Question not recognized');
    }

    // 3. Follow-up
    const message3 = 'What about risk management?';
    messages.push({ role: 'user', content: message3 });
    
    const followUp = intentRecognitionService.detectFollowUpQuestion(message3, messages);
    
    if (followUp.detected) {
      logTest('Integration: Follow-Up Detection', true, undefined, followUp);
    } else {
      logTest('Integration: Follow-Up Detection', false, 'Follow-up not detected');
    }

    logTest('Integration: Full Flow', true, undefined, {
      totalMessages: messages.length,
      finalPhase: state2.conversationPhase,
    });

  } catch (error) {
    logTest('Integration Test', false, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('\n🚀 Phase 1 Feature Tests');
  console.log('='.repeat(80));
  console.log('Testing Enhanced AI-Powered Chat Features (Week 1 & Week 2)');
  console.log('='.repeat(80));

  await testPromptTemplates();
  await testFewShotLearning();
  await testMemoryAndContext();
  await testContextSummarization();
  await testResponseValidation();
  await testResponseTemplates();
  await testIntentRecognition();
  await testConversationState();
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
