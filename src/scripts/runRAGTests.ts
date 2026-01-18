import { TestHelpers, TestSuite, TestResult } from './testHelpers';
import { RAGTests } from './tests/ragTests';

/**
 * Run RAG Service Tests Only
 */
async function runRAGTests() {
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 RAG Service Tests Only');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Verify configuration
  console.log('🔍 Verifying configuration...\n');
  const config = TestHelpers.verifyConfiguration();
  
  if (!config.valid) {
    console.error('❌ Configuration validation failed:\n');
    config.errors.forEach(error => console.error(`   - ${error}`));
    console.error('\n⚠️  Please fix configuration errors before running tests.\n');
    process.exit(1);
  }

  console.log('✅ Configuration verified successfully\n');

  // Run RAG tests
  console.log('🤖 Running RAG Service Tests...\n');
  
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

  // Exit with appropriate code
  if (failedTests === 0) {
    console.log('🎉 All RAG tests passed!\n');
    process.exit(0);
  } else {
    console.log(`⚠️  ${failedTests} test(s) failed. Please review the errors above.\n`);
    process.exit(1);
  }
}

// Run tests
runRAGTests().catch((error) => {
  console.error('\n❌ Test execution failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
