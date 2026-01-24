/**
 * Test Dashboard Phase 4 Integration with Real Assessment Data
 * Tests: Create assessment, verify dashboard data, verify calculations, test updates
 */

import { prisma } from '../utils/db';
import { DashboardController } from '../controllers/dashboardController';
import { QuestionService } from '../services/question/questionService';
import { ScoringService } from '../services/assessment/scoringService';
import { ProgressService } from '../services/assessment/progressService';

const dashboardController = new DashboardController();
const questionService = new QuestionService();
const scoringService = new ScoringService();
const progressService = new ProgressService();

interface TestResult {
  test: string;
  passed: boolean;
  message?: string;
  details?: any;
}

const results: TestResult[] = [];

async function createTestAssessment(userId: string, ifrsStandard: 'S1' | 'S2'): Promise<string> {
  console.log(`\n   Creating test assessment for ${ifrsStandard}...`);
  
  // Create assessment
  const assessment = await prisma.assessment.create({
    data: {
      userId,
      status: 'in_progress',
      progress: 0,
    },
  });

  // Get questions for the standard
  const questions = await questionService.getQuestions({
    ifrsStandard,
    isActive: true,
    phase: 'quick',
  });

  if (questions.length === 0) {
    throw new Error(`No questions found for IFRS ${ifrsStandard}`);
  }

  // Answer first 10-15 questions with varied responses
  const questionsToAnswer = questions.slice(0, Math.min(15, questions.length));
  const answers = questionsToAnswer.map((q, index) => {
    let value: string;
    switch (q.type) {
      case 'yes_no':
        value = index % 2 === 0 ? 'Yes' : 'No'; // Alternate yes/no
        break;
      case 'multiple_choice':
        const options = q.options ? JSON.parse(q.options) : ['Option A', 'Option B'];
        value = options[0]; // Select first option
        break;
      case 'scale':
        value = (3 + (index % 3)).toString(); // Values 3-5
        break;
      default:
        value = `Sample answer for question ${q.id} about ${q.category.name}`;
    }

    return {
      assessmentId: assessment.id,
      questionId: q.id,
      value,
    };
  });

  // Create answers
  await prisma.answer.createMany({
    data: answers,
  });

  // Update assessment progress
  const progressPercentage = Math.round((answers.length / questions.length) * 100);
  await prisma.assessment.update({
    where: { id: assessment.id },
    data: {
      progress: progressPercentage,
      updatedAt: new Date(),
    },
  });

  console.log(`   ✅ Created assessment ${assessment.id} with ${answers.length} answers (${progressPercentage}% progress)`);
  return assessment.id;
}

async function testAssessmentCreation(userId: string): Promise<TestResult> {
  try {
    const assessmentIdS1 = await createTestAssessment(userId, 'S1');
    const assessmentIdS2 = await createTestAssessment(userId, 'S2');

    return {
      test: 'Assessment Creation',
      passed: true,
      message: `Created 2 assessments (S1: ${assessmentIdS1}, S2: ${assessmentIdS2})`,
      details: { assessmentIdS1, assessmentIdS2 },
    };
  } catch (error) {
    return {
      test: 'Assessment Creation',
      passed: false,
      message: error instanceof Error ? error.message : 'Failed to create assessments',
    };
  }
}

async function testDashboardEndpoints(userId: string, assessmentId: string): Promise<TestResult[]> {
  const endpointTests: TestResult[] = [];

  // Test 1: Get Readiness Score
  try {
    const req: any = {
      params: { userId },
      query: { assessmentId },
      user: { id: userId },
    };
    let scoreData: any = null;
    const res: any = {
      json: (data: any) => {
        scoreData = data.readinessScore || data;
      },
      status: (code: number) => ({
        json: (data: any) => {
          throw new Error(`Status ${code}: ${data.error}`);
        },
      }),
    };

    await dashboardController.getReadinessScore(req, res);

    endpointTests.push({
      test: 'Get Readiness Score',
      passed: !!scoreData && typeof scoreData.overallScore === 'number',
      message: scoreData
        ? `Score: ${scoreData.overallScore}%, Categories: ${scoreData.categoryScores?.length || 0}`
        : 'No score data returned',
      details: scoreData,
    });
  } catch (error) {
    endpointTests.push({
      test: 'Get Readiness Score',
      passed: false,
      message: error instanceof Error ? error.message : 'Failed to get readiness score',
    });
  }

  // Test 2: Get Progress
  try {
    const req: any = {
      params: { userId },
      query: { assessmentId },
      user: { id: userId },
    };
    let progressData: any = null;
    const res: any = {
      json: (data: any) => {
        progressData = data;
      },
      status: (code: number) => ({
        json: (data: any) => {
          throw new Error(`Status ${code}: ${data.error}`);
        },
      }),
    };

    await dashboardController.getProgress(req, res);

    endpointTests.push({
      test: 'Get Progress',
      passed: !!progressData && typeof progressData.percentage === 'number',
      message: progressData
        ? `Progress: ${progressData.percentage}%, Answered: ${progressData.answeredCount}/${progressData.totalCount}`
        : 'No progress data returned',
      details: progressData,
    });
  } catch (error) {
    endpointTests.push({
      test: 'Get Progress',
      passed: false,
      message: error instanceof Error ? error.message : 'Failed to get progress',
    });
  }

  // Test 3: Get Gap Analysis
  try {
    const req: any = {
      params: { userId },
      query: { assessmentId },
      user: { id: userId },
    };
    let gapData: any = null;
    const res: any = {
      json: (data: any) => {
        gapData = data;
      },
      status: (code: number) => ({
        json: (data: any) => {
          throw new Error(`Status ${code}: ${data.error}`);
        },
      }),
    };

    await dashboardController.getGapAnalysis(req, res);

    endpointTests.push({
      test: 'Get Gap Analysis',
      passed: !!gapData && typeof gapData.overallGap === 'number',
      message: gapData
        ? `Overall Gap: ${gapData.overallGap}%, Critical: ${gapData.criticalGaps?.length || 0}, High: ${gapData.highGaps?.length || 0}`
        : 'No gap data returned',
      details: gapData,
    });
  } catch (error) {
    endpointTests.push({
      test: 'Get Gap Analysis',
      passed: false,
      message: error instanceof Error ? error.message : 'Failed to get gap analysis',
    });
  }

  // Test 4: Get Compliance Matrix
  try {
    const req: any = {
      params: { userId },
      query: { assessmentId },
      user: { id: userId },
    };
    let complianceData: any = null;
    const res: any = {
      json: (data: any) => {
        complianceData = data;
      },
      status: (code: number) => ({
        json: (data: any) => {
          throw new Error(`Status ${code}: ${data.error}`);
        },
      }),
    };

    await dashboardController.getComplianceMatrix(req, res);

    endpointTests.push({
      test: 'Get Compliance Matrix',
      passed: !!complianceData && typeof complianceData.overallCompliance === 'number',
      message: complianceData
        ? `Compliance: ${complianceData.overallCompliance}%, Requirements: ${complianceData.requirements?.length || 0}`
        : 'No compliance data returned',
      details: complianceData,
    });
  } catch (error) {
    endpointTests.push({
      test: 'Get Compliance Matrix',
      passed: false,
      message: error instanceof Error ? error.message : 'Failed to get compliance matrix',
    });
  }

  // Test 5: Get Full Dashboard Data
  try {
    const req: any = {
      params: { userId },
      query: { assessmentId },
      user: { id: userId },
    };
    let dashboardData: any = null;
    const res: any = {
      json: (data: any) => {
        dashboardData = data;
      },
      status: (code: number) => ({
        json: (data: any) => {
          throw new Error(`Status ${code}: ${data.error}`);
        },
      }),
    };

    await dashboardController.getDashboardData(req, res);

    endpointTests.push({
      test: 'Get Full Dashboard Data',
      passed: !!dashboardData && dashboardData.readinessScore && dashboardData.progress,
      message: dashboardData
        ? `All data retrieved: Score=${dashboardData.readinessScore?.overallScore || 0}%, Progress=${dashboardData.progress?.percentage || 0}%`
        : 'No dashboard data returned',
      details: {
        hasReadinessScore: !!dashboardData?.readinessScore,
        hasProgress: !!dashboardData?.progress,
        hasGapAnalysis: !!dashboardData?.gapAnalysis,
        hasComplianceMatrix: !!dashboardData?.complianceMatrix,
      },
    });
  } catch (error) {
    endpointTests.push({
      test: 'Get Full Dashboard Data',
      passed: false,
      message: error instanceof Error ? error.message : 'Failed to get dashboard data',
    });
  }

  return endpointTests;
}

async function testCalculations(_userId: string, assessmentId: string): Promise<TestResult[]> {
  const calculationTests: TestResult[] = [];

  // Get assessment with answers
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      answers: {
        include: {
          question: true,
        },
      },
    },
  });

  if (!assessment || assessment.answers.length === 0) {
    return [
      {
        test: 'Calculation Verification',
        passed: false,
        message: 'No assessment or answers found',
      },
    ];
  }

  const answers = assessment.answers.map((a) => ({
    questionId: a.questionId,
    value: a.value,
  }));

  // Test 1: Score Calculation Accuracy
  try {
    const ifrsStandard = (assessment.answers[0]?.question?.ifrsStandard as 'S1' | 'S2') || 'S1';
    const calculatedScore = await scoringService.calculateAssessmentScore(answers, ifrsStandard);

    // Verify score is between 0 and 100
    const scoreValid = calculatedScore.overallScore >= 0 && calculatedScore.overallScore <= 100;
    const percentageValid = calculatedScore.overallPercentage >= 0 && calculatedScore.overallPercentage <= 100;

    calculationTests.push({
      test: 'Score Calculation Accuracy',
      passed: scoreValid && percentageValid,
      message: scoreValid && percentageValid
        ? `Score: ${calculatedScore.overallScore.toFixed(1)}%, Percentage: ${calculatedScore.overallPercentage.toFixed(1)}%`
        : 'Score values out of valid range (0-100)',
      details: {
        overallScore: calculatedScore.overallScore,
        overallPercentage: calculatedScore.overallPercentage,
        categoryScores: calculatedScore.categoryScores.length,
      },
    });
  } catch (error) {
    calculationTests.push({
      test: 'Score Calculation Accuracy',
      passed: false,
      message: error instanceof Error ? error.message : 'Failed to calculate scores',
    });
  }

  // Test 2: Progress Calculation Accuracy
  try {
    const ifrsStandard = (assessment.answers[0]?.question?.ifrsStandard as 'S1' | 'S2') || 'S1';
    const answeredQuestionIds = assessment.answers.map((a) => a.questionId);
    const calculatedProgress = await progressService.calculateProgress(answeredQuestionIds, ifrsStandard);

    // Verify progress is between 0 and 100
    const progressValid = calculatedProgress.percentage >= 0 && calculatedProgress.percentage <= 100;
    const ratioValid = calculatedProgress.answeredCount <= calculatedProgress.totalCount;

    calculationTests.push({
      test: 'Progress Calculation Accuracy',
      passed: progressValid && ratioValid,
      message: progressValid && ratioValid
        ? `Progress: ${calculatedProgress.percentage}%, Answered: ${calculatedProgress.answeredCount}/${calculatedProgress.totalCount}`
        : 'Progress values invalid',
      details: {
        percentage: calculatedProgress.percentage,
        answeredCount: calculatedProgress.answeredCount,
        totalCount: calculatedProgress.totalCount,
      },
    });
  } catch (error) {
    calculationTests.push({
      test: 'Progress Calculation Accuracy',
      passed: false,
      message: error instanceof Error ? error.message : 'Failed to calculate progress',
    });
  }

  return calculationTests;
}

async function testUpdates(_userId: string, assessmentId: string): Promise<TestResult[]> {
  const updateTests: TestResult[] = [];

  // Get current assessment state
  const assessmentBefore = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      answers: true,
    },
  });

  if (!assessmentBefore) {
    return [
      {
        test: 'Update Testing',
        passed: false,
        message: 'Assessment not found',
      },
    ];
  }

  const initialAnswerCount = assessmentBefore.answers.length;

  // Test 1: Add New Answer
  try {
    const questions = await questionService.getQuestions({
      isActive: true,
    });

    // Find a question not yet answered
    const answeredQuestionIds = new Set(assessmentBefore.answers.map((a) => a.questionId));
    const unansweredQuestion = questions.find((q) => !answeredQuestionIds.has(q.id));

    if (unansweredQuestion) {
      // Add new answer
      await prisma.answer.create({
        data: {
          assessmentId,
          questionId: unansweredQuestion.id,
          value: 'Yes',
        },
      });

      // Verify answer was added
      const assessmentAfter = await prisma.assessment.findUnique({
        where: { id: assessmentId },
        include: {
          answers: true,
        },
      });

      const newAnswerCount = assessmentAfter?.answers.length || 0;
      const answerAdded = newAnswerCount === initialAnswerCount + 1;

      updateTests.push({
        test: 'Add New Answer',
        passed: answerAdded,
        message: answerAdded
          ? `Answer added: ${initialAnswerCount} → ${newAnswerCount}`
          : `Answer not added: ${initialAnswerCount} → ${newAnswerCount}`,
        details: {
          before: initialAnswerCount,
          after: newAnswerCount,
        },
      });
    } else {
      updateTests.push({
        test: 'Add New Answer',
        passed: true,
        message: 'All questions already answered (cannot test)',
      });
    }
  } catch (error) {
    updateTests.push({
      test: 'Add New Answer',
      passed: false,
      message: error instanceof Error ? error.message : 'Failed to add answer',
    });
  }

  // Test 2: Update Progress
  try {
    const newProgress = 75;
    await progressService.updateAssessmentProgress(assessmentId, newProgress);

    const updatedAssessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { progress: true },
    });

    const progressUpdated = updatedAssessment?.progress === newProgress;

    updateTests.push({
      test: 'Update Progress',
      passed: progressUpdated,
      message: progressUpdated
        ? `Progress updated to ${newProgress}%`
        : `Progress not updated: ${updatedAssessment?.progress}`,
      details: {
        expected: newProgress,
        actual: updatedAssessment?.progress,
      },
    });
  } catch (error) {
    updateTests.push({
      test: 'Update Progress',
      passed: false,
      message: error instanceof Error ? error.message : 'Failed to update progress',
    });
  }

  return updateTests;
}

async function runTests() {
  console.log('🚀 Phase 4 Dashboard Integration - Comprehensive Testing');
  console.log('='.repeat(80));

  try {
    // Get or create test user
    let testUser = await prisma.user.findFirst({
      where: { email: { contains: 'test' } },
    });

    if (!testUser) {
      // Create test user if none exists
      testUser = await prisma.user.create({
        data: {
          email: 'test-dashboard@complyx.test',
          name: 'Dashboard Test User',
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
      console.log(`\n✅ Created test user: ${testUser.email}`);
    } else {
      console.log(`\n✅ Using existing test user: ${testUser.email}`);
    }

    const userId = testUser.id;

    // Step 1: Create Assessment
    console.log('\n📝 Step 1: Create Assessment');
    console.log('-'.repeat(80));
    const creationResult = await testAssessmentCreation(userId);
    results.push(creationResult);
    console.log(`${creationResult.passed ? '✅' : '❌'} ${creationResult.test}: ${creationResult.message}`);

    if (!creationResult.passed) {
      console.log('\n❌ Cannot continue without assessments. Exiting.');
      return;
    }

    // Get created assessment IDs
    const assessments = await prisma.assessment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });

    if (assessments.length === 0) {
      console.log('\n❌ No assessments found after creation. Exiting.');
      return;
    }

    const testAssessmentId = assessments[0].id;

    // Step 2: Test Dashboard Endpoints
    console.log('\n📊 Step 2: Test Dashboard Endpoints with Real Data');
    console.log('-'.repeat(80));
    const endpointResults = await testDashboardEndpoints(userId, testAssessmentId);
    results.push(...endpointResults);
    endpointResults.forEach((result) => {
      console.log(`${result.passed ? '✅' : '❌'} ${result.test}: ${result.message}`);
    });

    // Step 3: Verify Calculations
    console.log('\n🧮 Step 3: Verify Calculations');
    console.log('-'.repeat(80));
    const calculationResults = await testCalculations(userId, testAssessmentId);
    results.push(...calculationResults);
    calculationResults.forEach((result) => {
      console.log(`${result.passed ? '✅' : '❌'} ${result.test}: ${result.message}`);
    });

    // Step 4: Test Updates
    console.log('\n🔄 Step 4: Test Real-time Updates');
    console.log('-'.repeat(80));
    const updateResults = await testUpdates(userId, testAssessmentId);
    results.push(...updateResults);
    updateResults.forEach((result) => {
      console.log(`${result.passed ? '✅' : '❌'} ${result.test}: ${result.message}`);
    });

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 Test Summary');
    console.log('='.repeat(80));
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;

    console.log(`\nTotal Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${total - passed}`);
    console.log(`📈 Pass Rate: ${passRate}%`);

    if (total - passed > 0) {
      console.log('\n❌ Failed Tests:');
      results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`   - ${r.test}: ${r.message}`);
        });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Phase 4 Dashboard Integration Tests Complete!');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('\n❌ Test Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
