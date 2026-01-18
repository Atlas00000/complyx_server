import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface TestResult {
  testName: string;
  passed: boolean;
  message?: string;
  duration?: number;
  error?: string;
  details?: Record<string, any>;
}

export interface TestSuite {
  suiteName: string;
  tests: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
}

/**
 * Test Helper Utilities
 * Provides common utilities for integration testing
 */
export class TestHelpers {
  /**
   * Create a test document file
   */
  static createTestDocument(content: string, filename: string): string {
    const testDir = path.join(process.cwd(), 'documents');
    
    // Ensure documents directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const filePath = path.join(testDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    
    return filePath;
  }

  /**
   * Remove test document file
   */
  static removeTestDocument(filename: string): void {
    const filePath = path.join(process.cwd(), 'documents', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Read test document
   */
  static readTestDocument(filename: string): string {
    const filePath = path.join(process.cwd(), 'documents', filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Test document not found: ${filename}`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Wait for specified milliseconds
   */
  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if environment variable is set
   */
  static isEnvSet(key: string): boolean {
    const value = process.env[key];
    return !!value && value.trim().length > 0;
  }

  /**
   * Get required environment variable
   */
  static getRequiredEnv(key: string): string {
    const value = process.env[key];
    if (!value || value.trim().length === 0) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }

  /**
   * Verify configuration for Phase 2 testing
   */
  static verifyConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required env vars
    const requiredVars = ['PINECONE_API_KEY', 'GEMINI_API_KEY', 'VECTOR_DB_TYPE'];
    for (const key of requiredVars) {
      if (!this.isEnvSet(key)) {
        errors.push(`Missing required environment variable: ${key}`);
      }
    }

    // Verify VECTOR_DB_TYPE is set to pinecone
    if (process.env.VECTOR_DB_TYPE !== 'pinecone') {
      errors.push(`VECTOR_DB_TYPE must be set to 'pinecone' for testing. Current: ${process.env.VECTOR_DB_TYPE}`);
    }

    // Verify EMBEDDING_DIMENSION is set
    const dimension = parseInt(process.env.EMBEDDING_DIMENSION || '768', 10);
    if (dimension !== 768) {
      errors.push(`EMBEDDING_DIMENSION must be 768. Current: ${dimension}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format test result for display
   */
  static formatTestResult(result: TestResult): string {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    const message = result.message ? ` - ${result.message}` : '';
    const error = result.error ? `\n   Error: ${result.error}` : '';
    
    return `${status} ${result.testName}${duration}${message}${error}`;
  }

  /**
   * Format test suite summary
   */
  static formatSuiteSummary(suite: TestSuite): string {
    const passRate = suite.totalTests > 0 
      ? Math.round((suite.passedTests / suite.totalTests) * 100) 
      : 0;
    
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Test Suite: ${suite.suiteName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Tests: ${suite.totalTests}
Passed: ${suite.passedTests} ✅
Failed: ${suite.failedTests} ❌
Pass Rate: ${passRate}%
Duration: ${suite.duration}ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }

  /**
   * Run test with timing
   */
  static async runTest<T>(
    testName: string,
    testFn: () => Promise<T>
  ): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      return {
        testName,
        passed: true,
        duration,
        details: result as any,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        testName,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create test data for IFRS S1
   */
  static getIFRSS1TestContent(): string {
    return `IFRS S1: General Requirements for Disclosure of Sustainability-related Financial Information

Overview:
IFRS S1 establishes the general requirements for disclosure of sustainability-related financial information. It provides a comprehensive framework for entities to report on sustainability-related risks and opportunities.

Key Requirements:
1. An entity must disclose material information about sustainability-related risks and opportunities that could reasonably be expected to affect the entity's prospects.
2. Information must be disclosed alongside related financial statements for the same reporting period.
3. Disclosures must be structured using the four pillars: governance, strategy, risk management, and metrics and targets.
4. The entity must apply judgment to determine what information is material.

Relationship with IFRS S2:
IFRS S1 provides the overarching framework and general requirements for all sustainability disclosures. IFRS S2 (Climate-related Disclosures) is a specific application of IFRS S1's principles, focusing specifically on climate-related risks and opportunities. IFRS S2 builds upon and supplements the general requirements in IFRS S1.`;
  }

  /**
   * Create test data for IFRS S2
   */
  static getIFRSS2TestContent(): string {
    return `IFRS S2: Climate-related Disclosures

Overview:
IFRS S2 requires an entity to disclose information about climate-related risks and opportunities that could reasonably be expected to affect the entity's cash flows, its access to finance, or cost of capital over the short, medium, or long term.

Key Requirements:
1. An entity must disclose material information about climate-related physical risks and transition risks.
2. Information about climate-related opportunities must be disclosed when material.
3. Disclosures must follow the four pillars structure established in IFRS S1: governance, strategy, risk management, and metrics and targets.
4. The entity must disclose its climate-related targets and progress toward meeting those targets.

Relationship with IFRS S1:
IFRS S2 is a specific application of IFRS S1's general requirements. It focuses specifically on climate-related disclosures while applying the same four-pillar structure and materiality concepts from IFRS S1. Entities must comply with both IFRS S1 and IFRS S2 when disclosing climate-related information.`;
  }
}
