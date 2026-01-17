import { ConversationMemoryService } from '../services/ai/memory/conversationMemoryService';
import { EnhancedContextBuilder } from '../services/ai/context/enhancedContextBuilder';
import { RecommendationEngine } from '../services/ai/recommendations/recommendationEngine';
import { IndustryGuidanceService } from '../services/ai/guidance/industryGuidanceService';
import { CitationService } from '../services/ai/citations/citationService';
import type { Message } from '../services/ai/interfaces/AIProvider';

async function testAdvancedAI() {
  console.log('🧪 Testing Advanced AI Features...\n');

  try {
    // Test 1: Conversation Memory Service
    console.log('📋 Test 1: Conversation Memory Service');
    const memoryService = new ConversationMemoryService();
    
    const testMessages: Message[] = [
      { role: 'system', content: 'You are Complyx, an IFRS assistant.' },
      { role: 'user', content: 'What is IFRS S1?' },
      { role: 'assistant', content: 'IFRS S1 is a general requirements standard.' },
      { role: 'user', content: 'Tell me about governance requirements.' },
      { role: 'assistant', content: 'Governance requirements include board oversight.' },
    ];

    await memoryService.saveConversation('test-session-1', 'test-user@example.com', testMessages);
    console.log('✅ Conversation saved to memory');

    const retrievedMessages = await memoryService.getConversationMemory('test-session-1');
    console.log(`✅ Retrieved ${retrievedMessages.length} messages from memory`);

    const context = await memoryService.getConversationContext('test-session-1');
    console.log(`✅ Context retrieved: ${context.messages.length} messages, ${context.totalMessageCount} total`);

    const stats = await memoryService.getMemoryStats('test-session-1');
    console.log(`✅ Memory stats: ${stats.messageCount} messages`);

    // Test 2: Enhanced Context Builder
    console.log('\n📋 Test 2: Enhanced Context Builder');
    const contextBuilder = new EnhancedContextBuilder();

    const extractedContext = contextBuilder.extractContext(testMessages);
    console.log(`✅ Extracted context:`);
    console.log(`   - IFRS Standard: ${extractedContext.ifrsStandard || 'None'}`);
    console.log(`   - Phase: ${extractedContext.assessmentPhase || 'None'}`);
    console.log(`   - Key Topics: ${extractedContext.keyTopics.join(', ') || 'None'}`);
    console.log(`   - User Intent: ${extractedContext.userIntent}`);

    const enhancedContext = contextBuilder.buildEnhancedContext(
      testMessages,
      'What are the metrics requirements?',
      { phase: 'quick', standard: 'S1', progress: 50, answeredCount: 5, totalCount: 10 }
    );
    console.log(`✅ Enhanced context built: ${enhancedContext.messageCount} messages`);
    console.log(`   - Assessment Phase: ${enhancedContext.assessmentContext?.phase}`);
    console.log(`   - IFRS Standard: ${enhancedContext.assessmentContext?.standard}`);
    console.log(`   - Progress: ${enhancedContext.assessmentContext?.progress}%`);

    const keyInfo = contextBuilder.extractKeyInformation(testMessages);
    console.log(`✅ Key information extracted:`);
    console.log(`   - Topics: ${keyInfo.topics.join(', ')}`);
    console.log(`   - Questions Asked: ${keyInfo.questionsAsked}`);
    console.log(`   - Answers Provided: ${keyInfo.answersProvided}`);

    // Test 3: Citation Service
    console.log('\n📋 Test 3: Citation Service');
    const citationService = new CitationService();

    const responseText = 'According to IFRS S1-1, governance requirements include board oversight. IFRS S2-4 requires disclosure of climate metrics.';
    const citations = citationService.extractCitations(responseText, ['S1-1', 'S2-4']);
    console.log(`✅ Extracted ${citations.length} citations:`);
    citations.forEach((citation, index) => {
      console.log(`   ${index + 1}. ${citation.title} (${citation.section})`);
    });

    const needsCitations = citationService.needsCitations(responseText);
    console.log(`✅ Needs citations: ${needsCitations}`);

    const responseWithCitations = citationService.addCitationsToResponse(responseText, citations);
    console.log(`✅ Response with citations: ${responseWithCitations.citations.length} citations`);
    console.log(`   - Confidence: ${responseWithCitations.confidence.overall}%`);

    const confidence = citationService.calculateConfidence(responseText, citations);
    console.log(`✅ Confidence score: ${confidence.overall}%`);
    console.log(`   - Source Quality: ${confidence.factors.sourceQuality}%`);
    console.log(`   - Answer Completeness: ${confidence.factors.answerCompleteness}%`);
    console.log(`   - Factuality: ${confidence.factors.factuality}%`);
    console.log(`   - Relevance: ${confidence.factors.relevance}%`);

    const formattedCitations = citationService.formatCitations(citations);
    console.log(`✅ Formatted citations: ${formattedCitations.length} characters`);

    // Test 4: Industry Guidance Service
    console.log('\n📋 Test 4: Industry Guidance Service');
    const guidanceService = new IndustryGuidanceService();

    const financialGuidance = guidanceService.getIndustryGuidance('financial_services');
    console.log(`✅ Industry guidance for ${financialGuidance.industry}:`);
    console.log(`   - Guidance: ${financialGuidance.guidance.substring(0, 60)}...`);
    console.log(`   - Recommendations: ${financialGuidance.specificRecommendations.length}`);
    console.log(`   - Best Practices: ${financialGuidance.bestPractices.length}`);
    console.log(`   - Common Pitfalls: ${financialGuidance.commonPitfalls.length}`);

    const contextualGuidance = await guidanceService.getContextualGuidance(
      'financial_services',
      [{ questionId: 'test-1', value: 'Yes' }, { questionId: 'test-2', value: 'No' }],
      'S1',
      40
    );
    console.log(`✅ Contextual guidance: ${contextualGuidance.guidance.substring(0, 60)}...`);
    console.log(`   - Recommendations: ${contextualGuidance.recommendations.length}`);
    console.log(`   - Examples: ${contextualGuidance.examples.length}`);
    console.log(`   - Next Steps: ${contextualGuidance.nextSteps.length}`);

    // Test 5: Recommendation Engine
    console.log('\n📋 Test 5: Recommendation Engine');
    const recommendationEngine = new RecommendationEngine();

    const sampleAnswers = [
      { questionId: 'q1', value: 'Yes' },
      { questionId: 'q2', value: 'No' },
      { questionId: 'q3', value: 'We have a sustainability committee' },
    ];

    const recommendations = await recommendationEngine.generateRecommendations(
      'test-assessment-1',
      'test-user@example.com',
      sampleAnswers,
      'S1',
      'financial_services'
    );
    console.log(`✅ Generated ${recommendations.recommendations.length} recommendations`);
    console.log(`   - Prioritized Actions: ${recommendations.prioritizedActions.length}`);
    console.log(`   - Next Steps: ${recommendations.nextSteps.length}`);

    if (recommendations.recommendations.length > 0) {
      const firstRec = recommendations.recommendations[0];
      console.log(`   - Sample Recommendation: ${firstRec.title}`);
      console.log(`     Category: ${firstRec.category}, Priority: ${firstRec.priority}`);
      console.log(`     Impact: ${firstRec.impact}, Effort: ${firstRec.estimatedEffort}`);
    }

    const categoryRecs = await recommendationEngine.getCategoryRecommendations(
      'test-assessment-1',
      'governance',
      sampleAnswers,
      'S1'
    );
    console.log(`✅ Governance recommendations: ${categoryRecs.length}`);

    // Test 6: Integration Test - Full Flow
    console.log('\n📋 Test 6: Integration Test - Full Flow');
    
    // Build context with enhanced builder
    const integrationContext = contextBuilder.buildEnhancedContext(
      testMessages,
      'Help me understand governance requirements',
      { phase: 'detailed', standard: 'S1', progress: 75, answeredCount: 15, totalCount: 20 }
    );

    // Extract citations
    const integrationCitations = citationService.extractCitations(
      'Governance requirements under IFRS S1-1 include board oversight and management accountability.',
      ['S1-1']
    );

    // Add citations to response
    const responseWithIntegrationCitations = citationService.addCitationsToResponse(
      'Governance requirements under IFRS S1-1 include board oversight and management accountability.',
      integrationCitations
    );

    console.log(`✅ Integration test passed:`);
    console.log(`   - Context built: ${integrationContext.messageCount} messages`);
    console.log(`   - Citations extracted: ${responseWithIntegrationCitations.citations.length}`);
    console.log(`   - Confidence: ${responseWithIntegrationCitations.confidence.overall}%`);

    console.log('\n✅ All Advanced AI Features tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

testAdvancedAI()
  .then(() => {
    console.log('\n🎉 Advanced AI Features testing completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
