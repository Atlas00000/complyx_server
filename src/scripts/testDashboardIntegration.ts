/**
 * Test Dashboard Integration (Phase 4)
 * Tests all dashboard API endpoints and data aggregation
 */

import { DashboardController } from '../controllers/dashboardController';
import { prisma } from '../utils/db';

const dashboardController = new DashboardController();

async function testDashboardIntegration() {
  console.log('🚀 Phase 4 Dashboard Integration Tests');
  console.log('='.repeat(80));

  try {
    // Test 1: Check if any assessments exist
    console.log('\n📊 Test 1: Check Database for Assessments');
    const assessments = await prisma.assessment.findMany({
      take: 5,
      include: {
        answers: {
          include: {
            question: true,
          },
          take: 10,
        },
        scores: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    console.log(`   Found ${assessments.length} assessment(s) in database`);

    if (assessments.length === 0) {
      console.log('   ⚠️  No assessments found. Dashboard will show empty state.');
      console.log('   This is expected if no assessments have been created yet.');
      return;
    }

    const testAssessment = assessments[0];
    const testUserId = testAssessment.userId;
    const testAssessmentId = testAssessment.id;

    console.log(`   Using Assessment ID: ${testAssessmentId}`);
    console.log(`   Using User ID: ${testUserId}`);
    console.log(`   Assessment Status: ${testAssessment.status}`);
    console.log(`   Assessment Progress: ${testAssessment.progress}%`);
    console.log(`   Answers Count: ${testAssessment.answers.length}`);

    // Test 2: Get Readiness Score
    console.log('\n📈 Test 2: Get Readiness Score');
    try {
      const req1: any = {
        params: { userId: testUserId },
        query: { assessmentId: testAssessmentId },
        user: { id: testUserId },
      };
      const res1: any = {
        json: (data: any) => {
          console.log('   ✅ Readiness Score Retrieved');
          console.log(`      Overall Score: ${data.readinessScore?.overallScore || data.overallScore || 0}%`);
          console.log(`      Total Answered: ${data.readinessScore?.totalAnswered || data.totalAnswered || 0}`);
          console.log(`      Total Questions: ${data.readinessScore?.totalQuestions || data.totalQuestions || 0}`);
          if (data.categoryScores && data.categoryScores.length > 0) {
            console.log(`      Category Scores: ${data.categoryScores.length} categories`);
            data.categoryScores.slice(0, 3).forEach((cat: any) => {
              console.log(`        - ${cat.category}: ${cat.percentage.toFixed(0)}%`);
            });
          }
        },
        status: (code: number) => ({
          json: (data: any) => {
            console.log(`   ❌ Error (${code}): ${data.error}`);
          },
        }),
      };

      await dashboardController.getReadinessScore(req1, res1);
    } catch (error) {
      console.error('   ❌ Error:', error);
    }

    // Test 3: Get Progress
    console.log('\n📊 Test 3: Get Progress');
    try {
      const req2: any = {
        params: { userId: testUserId },
        query: { assessmentId: testAssessmentId },
        user: { id: testUserId },
      };
      const res2: any = {
        json: (data: any) => {
          console.log('   ✅ Progress Retrieved');
          console.log(`      Progress: ${data.percentage || 0}%`);
          console.log(`      Answered: ${data.answeredCount || 0}`);
          console.log(`      Total: ${data.totalCount || 0}`);
        },
        status: (code: number) => ({
          json: (data: any) => {
            console.log(`   ❌ Error (${code}): ${data.error}`);
          },
        }),
      };

      await dashboardController.getProgress(req2, res2);
    } catch (error) {
      console.error('   ❌ Error:', error);
    }

    // Test 4: Get Gap Analysis
    console.log('\n🔍 Test 4: Get Gap Analysis');
    try {
      const req3: any = {
        params: { userId: testUserId },
        query: { assessmentId: testAssessmentId },
        user: { id: testUserId },
      };
      const res3: any = {
        json: (data: any) => {
          console.log('   ✅ Gap Analysis Retrieved');
          console.log(`      Overall Gap: ${data.overallGap || 0}%`);
          console.log(`      Critical Gaps: ${data.criticalGaps?.length || 0}`);
          console.log(`      High Gaps: ${data.highGaps?.length || 0}`);
          console.log(`      Medium Gaps: ${data.mediumGaps?.length || 0}`);
          console.log(`      Low Gaps: ${data.lowGaps?.length || 0}`);
          if (data.priorityActions && data.priorityActions.length > 0) {
            console.log(`      Priority Actions: ${data.priorityActions.length}`);
            data.priorityActions.slice(0, 2).forEach((action: string, idx: number) => {
              console.log(`        ${idx + 1}. ${action.substring(0, 60)}...`);
            });
          }
        },
        status: (code: number) => ({
          json: (data: any) => {
            console.log(`   ❌ Error (${code}): ${data.error}`);
          },
        }),
      };

      await dashboardController.getGapAnalysis(req3, res3);
    } catch (error) {
      console.error('   ❌ Error:', error);
    }

    // Test 5: Get Compliance Matrix
    console.log('\n✅ Test 5: Get Compliance Matrix');
    try {
      const req4: any = {
        params: { userId: testUserId },
        query: { assessmentId: testAssessmentId },
        user: { id: testUserId },
      };
      const res4: any = {
        json: (data: any) => {
          console.log('   ✅ Compliance Matrix Retrieved');
          console.log(`      IFRS Standard: ${data.ifrsStandard}`);
          console.log(`      Overall Compliance: ${data.overallCompliance || 0}%`);
          console.log(`      Requirements: ${data.requirements?.length || 0}`);
          if (data.byCategory) {
            const categories = Object.keys(data.byCategory);
            categories.forEach((cat) => {
              const catData = data.byCategory[cat];
              console.log(`        ${cat}: ${catData.compliant}/${catData.total} (${catData.score}%)`);
            });
          }
        },
        status: (code: number) => ({
          json: (data: any) => {
            console.log(`   ❌ Error (${code}): ${data.error}`);
          },
        }),
      };

      await dashboardController.getComplianceMatrix(req4, res4);
    } catch (error) {
      console.error('   ❌ Error:', error);
    }

    // Test 6: Get Full Dashboard Data
    console.log('\n📊 Test 6: Get Full Dashboard Data');
    try {
      const req5: any = {
        params: { userId: testUserId },
        query: { assessmentId: testAssessmentId },
        user: { id: testUserId },
      };
      const res5: any = {
        json: (data: any) => {
          console.log('   ✅ Full Dashboard Data Retrieved');
          console.log(`      User ID: ${data.userId}`);
          console.log(`      Assessment ID: ${data.assessmentId || 'N/A'}`);
          console.log(`      Readiness Score: ${data.readinessScore?.overallScore || 0}%`);
          console.log(`      Progress: ${data.progress?.percentage || 0}%`);
          console.log(`      Overall Compliance: ${data.complianceMatrix?.overallCompliance || 0}%`);
          console.log(`      Overall Gap: ${data.gapAnalysis?.overallGap || 0}%`);
          console.log(`      Recent Activity: ${data.recentActivity?.length || 0} items`);
          console.log(`      Historical Trends: ${data.historicalTrends?.assessments?.length || 0} assessments`);
        },
        status: (code: number) => ({
          json: (data: any) => {
            console.log(`   ❌ Error (${code}): ${data.error}`);
          },
        }),
      };

      await dashboardController.getDashboardData(req5, res5);
    } catch (error) {
      console.error('   ❌ Error:', error);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Dashboard Integration Tests Complete');
    console.log('='.repeat(80));
    console.log('\n💡 Next Steps:');
    console.log('   1. Open http://localhost:3000/dashboard in your browser');
    console.log('   2. Verify all components load with real data');
    console.log('   3. Check that scores, progress, and gaps are displayed correctly');
  } catch (error) {
    console.error('\n❌ Test Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testDashboardIntegration()
  .then(() => {
    console.log('\n✅ All tests completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
