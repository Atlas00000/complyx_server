import { TestHelpers, TestResult as _TestResult, TestSuite } from './testHelpers';
import { VectorDatabaseTests } from './tests/vectorDatabaseTests';
import { IngestionTests } from './tests/ingestionTests';
import { RAGTests } from './tests/ragTests';

/**
 * Integration Test Runner for Phase 2
 * Runs all integration tests for vector database, ingestion, and RAG services
 */
class IntegrationTestRunner {
  private suites: TestSuite[] = [];

  /**
   * Run configuration verification
   */
  async verifyConfiguration(): Promise<boolean> {
    console.log('\n🔍 Verifying configuration...\n');
    
    const config = TestHelpers.verifyConfiguration();
    
    if (!config.valid) {
      console.error('❌ Configuration validation failed:\n');
      config.errors.forEach(error => console.error(`   - ${error}`));
      console.error('\n⚠️  Please fix configuration errors before running tests.\n');
      return false;
    }

    console.log('✅ Configuration verified successfully\n');
    return true;
  }

  /**
   * Run vector database tests
   */
  async runVectorDatabaseTests(): Promise<TestSuite> {
    console.log('\n📊 Running Vector Database Tests...\n');
    
    const testRunner = new VectorDatabaseTests();
    const startTime = Date.now();
    const results = await testRunner.runAllTests();

    // Display results
    results.forEach(result => {
      console.log(TestHelpers.formatTestResult(result));
    });

    const duration = Date.now() - startTime;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.filter(r => !r.passed).length;

    const suite: TestSuite = {
      suiteName: 'Vector Database Tests',
      tests: results,
      totalTests: results.length,
      passedTests,
      failedTests,
      duration,
    };

    console.log(TestHelpers.formatSuiteSummary(suite));
    
    return suite;
  }

  /**
   * Run ingestion tests
   */
  async runIngestionTests(): Promise<TestSuite> {
    console.log('\n📥 Running Document Ingestion Tests...\n');
    
    const testRunner = new IngestionTests();
    const startTime = Date.now();
    const results = await testRunner.runAllTests();

    // Display results
    results.forEach(result => {
      console.log(TestHelpers.formatTestResult(result));
    });

    const duration = Date.now() - startTime;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.filter(r => !r.passed).length;

    const suite: TestSuite = {
      suiteName: 'Document Ingestion Tests',
      tests: results,
      totalTests: results.length,
      passedTests,
      failedTests,
      duration,
    };

    console.log(TestHelpers.formatSuiteSummary(suite));
    
    return suite;
  }

  /**
   * Run RAG tests
   */
  async runRAGTests(): Promise<TestSuite> {
    console.log('\n🤖 Running RAG Service Tests...\n');
    
    const testRunner = new RAGTests();
    const startTime = Date.now();
    const results = await testRunner.runAllTests();

    // Display results
    results.forEach(result => {
      console.log(TestHelpers.formatTestResult(result));
    });

    const duration = Date.now() - startTime;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.filter(r => !r.passed).length;

    const suite: TestSuite = {
      suiteName: 'RAG Service Tests',
      tests: results,
      totalTests: results.length,
      passedTests,
      failedTests,
      duration,
    };

    console.log(TestHelpers.formatSuiteSummary(suite));
    
    // Cleanup
    await testRunner.cleanup();
    
    return suite;
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 Phase 2 Integration Test Suite');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Verify configuration first
    const configValid = await this.verifyConfiguration();
    if (!configValid) {
      process.exit(1);
    }

    try {
      // Run test suites
      const vectorDbSuite = await this.runVectorDatabaseTests();
      await TestHelpers.wait(1000);

      const ingestionSuite = await this.runIngestionTests();
      await TestHelpers.wait(1000);

      const ragSuite = await this.runRAGTests();

      // Store suites
      this.suites = [vectorDbSuite, ingestionSuite, ragSuite];

      // Display final summary
      this.displayFinalSummary();

    } catch (error) {
      console.error('\n❌ Test execution failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * Display final summary
   */
  displayFinalSummary(): void {
    const totalTests = this.suites.reduce((sum, suite) => sum + suite.totalTests, 0);
    const totalPassed = this.suites.reduce((sum, suite) => sum + suite.passedTests, 0);
    const totalFailed = this.suites.reduce((sum, suite) => sum + suite.failedTests, 0);
    const totalDuration = this.suites.reduce((sum, suite) => sum + suite.duration, 0);
    const passRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

    console.log('\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 FINAL TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total Test Suites: ${this.suites.length}`);
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${totalPassed} ✅`);
    console.log(`Failed: ${totalFailed} ${totalFailed > 0 ? '❌' : ''}`);
    console.log(`Pass Rate: ${passRate}%`);
    console.log(`Total Duration: ${totalDuration}ms (${Math.round(totalDuration / 1000)}s)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Display per-suite summary
    this.suites.forEach(suite => {
      const suitePassRate = suite.totalTests > 0 
        ? Math.round((suite.passedTests / suite.totalTests) * 100) 
        : 0;
      const status = suite.failedTests === 0 ? '✅' : '❌';
      console.log(`${status} ${suite.suiteName}: ${suite.passedTests}/${suite.totalTests} (${suitePassRate}%)`);
    });

    console.log('');

    // Exit with appropriate code
    if (totalFailed === 0) {
      console.log('🎉 All tests passed!\n');
      process.exit(0);
    } else {
      console.log(`⚠️  ${totalFailed} test(s) failed. Please review the errors above.\n`);
      process.exit(1);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const runner = new IntegrationTestRunner();
  await runner.runAllTests();
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ Test runner failed:', error);
    process.exit(1);
  });
}

export { IntegrationTestRunner };
