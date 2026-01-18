/**
 * Question Optimizer
 * Breaks complex questions into smaller, focused ones and supports multiple question formats
 */

import type { QuestionNode } from '../assessment/assessmentFlowEngine';

export type QuestionFormat = 'yes-no' | 'multiple-choice' | 'scale' | 'open-ended' | 'multi-select';

export interface ChunkedQuestion {
  id: string;
  parentId?: string; // Original question ID if this is a chunk
  question: string;
  format: QuestionFormat;
  category: string;
  priority: 'high' | 'medium' | 'low';
  order: number; // Order within chunked set
  options?: string[];
  scaleRange?: { min: number; max: number; step?: number };
  dependsOn?: string[];
}

export interface QuestionChunkingResult {
  originalQuestion: QuestionNode;
  chunks: ChunkedQuestion[];
  shouldChunk: boolean;
  reason?: string;
}

/**
 * Question Optimizer
 * Handles question chunking and format optimization
 */
export class QuestionOptimizer {
  /**
   * Check if a question should be chunked
   */
  shouldChunk(question: QuestionNode): boolean {
    // Chunk if question is too long or contains multiple concepts
    const questionLength = question.question.length;
    const hasMultipleConcepts = this.hasMultipleConcepts(question.question);
    const hasMultipleParts = question.question.includes(';') || question.question.includes(' and ');

    return questionLength > 150 || hasMultipleConcepts || hasMultipleParts;
  }

  /**
   * Check if question contains multiple concepts
   */
  private hasMultipleConcepts(question: string): boolean {
    // Simple heuristic: check for multiple question words or conjunctions
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which'];
    let count = 0;
    for (const word of questionWords) {
      if (question.toLowerCase().includes(word)) {
        count++;
      }
    }
    return count > 1;
  }

  /**
   * Chunk a complex question into smaller, focused questions
   */
  chunkQuestion(question: QuestionNode): QuestionChunkingResult {
    if (!this.shouldChunk(question)) {
      return {
        originalQuestion: question,
        chunks: [this.convertToChunked(question)],
        shouldChunk: false,
      };
    }

    const chunks: ChunkedQuestion[] = [];
    
    // Strategy 1: Split by conjunctions (and, or, but)
    const parts = this.splitByConjunctions(question.question);
    
    if (parts.length > 1) {
      parts.forEach((part, index) => {
        chunks.push({
          id: `${question.id}-chunk-${index + 1}`,
          parentId: question.id,
          question: part.trim(),
          format: question.format,
          category: question.category,
          priority: question.priority,
          order: index + 1,
          options: question.options,
          scaleRange: question.scaleRange,
          dependsOn: index > 0 ? [`${question.id}-chunk-${index}`] : question.dependsOn,
        });
      });
    } else {
      // Strategy 2: Split by sentence boundaries
      const sentences = this.splitBySentences(question.question);
      
      if (sentences.length > 1) {
        sentences.forEach((sentence, index) => {
          chunks.push({
            id: `${question.id}-chunk-${index + 1}`,
            parentId: question.id,
            question: sentence.trim(),
            format: question.format,
            category: question.category,
            priority: question.priority,
            order: index + 1,
            options: question.options,
            scaleRange: question.scaleRange,
            dependsOn: index > 0 ? [`${question.id}-chunk-${index}`] : question.dependsOn,
          });
        });
      } else {
        // Strategy 3: Extract key concepts and create focused questions
        const concepts = this.extractConcepts(question.question);
        
        concepts.forEach((concept, index) => {
          chunks.push({
            id: `${question.id}-chunk-${index + 1}`,
            parentId: question.id,
            question: this.buildFocusedQuestion(concept, question.question),
            format: question.format,
            category: question.category,
            priority: question.priority,
            order: index + 1,
            options: question.options,
            scaleRange: question.scaleRange,
            dependsOn: index > 0 ? [`${question.id}-chunk-${index}`] : question.dependsOn,
          });
        });
      }
    }

    return {
      originalQuestion: question,
      chunks,
      shouldChunk: true,
      reason: `Question chunked into ${chunks.length} focused questions`,
    };
  }

  /**
   * Split question by conjunctions
   */
  private splitByConjunctions(question: string): string[] {
    // Split by common conjunctions
    const conjunctions = [' and ', ' or ', ' but ', ' as well as ', ' in addition to '];
    let parts = [question];
    
    for (const conjunction of conjunctions) {
      const newParts: string[] = [];
      for (const part of parts) {
        if (part.includes(conjunction)) {
          const split = part.split(conjunction);
          newParts.push(...split);
        } else {
          newParts.push(part);
        }
      }
      parts = newParts;
    }
    
    return parts.filter(p => p.trim().length > 0);
  }

  /**
   * Split question by sentences
   */
  private splitBySentences(question: string): string[] {
    // Split by sentence boundaries
    return question.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  /**
   * Extract key concepts from question
   */
  private extractConcepts(question: string): string[] {
    // Extract key phrases (simplified - in production, use NLP)
    const concepts: string[] = [];
    
    // Look for key IFRS terms
    const ifrsTerms = [
      'governance', 'strategy', 'risk management', 'metrics', 'targets',
      'sustainability', 'climate', 'emissions', 'disclosures', 'reporting',
      'board oversight', 'management', 'stakeholder', 'value chain',
    ];
    
    for (const term of ifrsTerms) {
      if (question.toLowerCase().includes(term)) {
        concepts.push(term);
      }
    }
    
    // If no specific terms found, extract noun phrases (simplified)
    if (concepts.length === 0) {
      const words = question.split(/\s+/);
      // Take first 3-5 words as concept
      if (words.length > 3) {
        concepts.push(words.slice(0, 4).join(' '));
      } else {
        concepts.push(question);
      }
    }
    
    return concepts.length > 0 ? concepts : [question];
  }

  /**
   * Build focused question from concept
   */
  private buildFocusedQuestion(concept: string, originalQuestion: string): string {
    // Try to preserve question structure
    if (originalQuestion.toLowerCase().startsWith('what')) {
      return `What is your organization's approach to ${concept}?`;
    }
    if (originalQuestion.toLowerCase().startsWith('how')) {
      return `How does your organization handle ${concept}?`;
    }
    if (originalQuestion.toLowerCase().startsWith('does')) {
      return `Does your organization have ${concept}?`;
    }
    if (originalQuestion.toLowerCase().startsWith('is')) {
      return `Is ${concept} implemented in your organization?`;
    }
    
    // Default: create focused question
    return `Regarding ${concept}: ${originalQuestion}`;
  }

  /**
   * Convert QuestionNode to ChunkedQuestion
   */
  private convertToChunked(question: QuestionNode): ChunkedQuestion {
    return {
      id: question.id,
      question: question.question,
      format: question.format,
      category: question.category,
      priority: question.priority,
      order: 1,
      options: question.options,
      scaleRange: question.scaleRange,
      dependsOn: question.dependsOn,
    };
  }

  /**
   * Optimize question format based on question content
   */
  optimizeFormat(question: QuestionNode): QuestionFormat {
    // If format already specified, use it
    if (question.format) {
      return question.format;
    }

    const questionLower = question.question.toLowerCase();

    // Yes/No questions
    if (
      questionLower.startsWith('does') ||
      questionLower.startsWith('do ') ||
      questionLower.startsWith('is ') ||
      questionLower.startsWith('are ') ||
      questionLower.startsWith('has ') ||
      questionLower.startsWith('have ') ||
      questionLower.includes('yes or no')
    ) {
      return 'yes-no';
    }

    // Multiple choice questions
    if (
      questionLower.includes('which of the following') ||
      questionLower.includes('select from') ||
      questionLower.includes('choose from') ||
      (question.options && question.options.length > 0)
    ) {
      return question.options && question.options.length > 3 ? 'multi-select' : 'multiple-choice';
    }

    // Scale questions (rating, level, degree)
    if (
      questionLower.includes('rate') ||
      questionLower.includes('level') ||
      questionLower.includes('scale') ||
      questionLower.includes('degree') ||
      questionLower.includes('extent') ||
      questionLower.includes('how much') ||
      questionLower.includes('how many')
    ) {
      return 'scale';
    }

    // Open-ended questions (default)
    return 'open-ended';
  }

  /**
   * Generate options for multiple choice questions
   */
  generateOptions(question: QuestionNode, context?: any): string[] {
    if (question.options && question.options.length > 0) {
      return question.options;
    }

    // Generate default options based on question type
    const questionLower = question.question.toLowerCase();

    if (questionLower.includes('frequency')) {
      return ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually', 'Never'];
    }

    if (questionLower.includes('maturity') || questionLower.includes('level')) {
      return ['Not Started', 'Initial', 'Developing', 'Mature', 'Advanced'];
    }

    if (questionLower.includes('priority')) {
      return ['Low', 'Medium', 'High', 'Critical'];
    }

    if (questionLower.includes('status')) {
      return ['Not Implemented', 'In Progress', 'Partially Implemented', 'Fully Implemented'];
    }

    // Default yes/no options
    return ['Yes', 'No', 'Not Applicable'];
  }

  /**
   * Generate scale range for scale questions
   */
  generateScaleRange(question: QuestionNode): { min: number; max: number; step?: number } {
    if (question.scaleRange) {
      return question.scaleRange;
    }

    const questionLower = question.question.toLowerCase();

    // Default 1-5 scale
    if (questionLower.includes('rate') || questionLower.includes('scale')) {
      return { min: 1, max: 5, step: 1 };
    }

    // Percentage scale
    if (questionLower.includes('percentage') || questionLower.includes('%')) {
      return { min: 0, max: 100, step: 5 };
    }

    // Default 0-10 scale
    return { min: 0, max: 10, step: 1 };
  }

  /**
   * Optimize question text for clarity
   */
  optimizeQuestionText(question: string): string {
    let optimized = question.trim();

    // Remove redundant words
    optimized = optimized.replace(/\b(please|kindly|could you|would you)\b/gi, '');

    // Ensure question ends with ?
    if (!optimized.endsWith('?')) {
      optimized += '?';
    }

    // Capitalize first letter
    optimized = optimized.charAt(0).toUpperCase() + optimized.slice(1);

    // Remove extra spaces
    optimized = optimized.replace(/\s+/g, ' ');

    return optimized;
  }

  /**
   * Batch optimize multiple questions
   */
  optimizeQuestions(questions: QuestionNode[]): {
    optimized: QuestionNode[];
    chunked: QuestionChunkingResult[];
  } {
    const optimized: QuestionNode[] = [];
    const chunked: QuestionChunkingResult[] = [];

    for (const question of questions) {
      // Optimize format
      const optimizedFormat = this.optimizeFormat(question);
      
      // Optimize question text
      const optimizedText = this.optimizeQuestionText(question.question);

      // Generate options if needed
      const options = optimizedFormat === 'multiple-choice' || optimizedFormat === 'multi-select'
        ? this.generateOptions(question)
        : question.options;

      // Generate scale range if needed
      const scaleRange = optimizedFormat === 'scale'
        ? this.generateScaleRange(question)
        : question.scaleRange;

      const optimizedQuestion: QuestionNode = {
        ...question,
        format: optimizedFormat,
        question: optimizedText,
        options,
        scaleRange,
      };

      // Check if should chunk
      if (this.shouldChunk(optimizedQuestion)) {
        const chunkResult = this.chunkQuestion(optimizedQuestion);
        chunked.push(chunkResult);
        // Add chunks as separate questions
        chunkResult.chunks.forEach(chunk => {
          optimized.push({
            id: chunk.id,
            question: chunk.question,
            category: chunk.category,
            priority: chunk.priority,
            format: chunk.format,
            options: chunk.options,
            scaleRange: chunk.scaleRange,
            dependsOn: chunk.dependsOn,
            skipConditions: question.skipConditions,
            branchConditions: question.branchConditions,
          });
        });
      } else {
        optimized.push(optimizedQuestion);
      }
    }

    return { optimized, chunked };
  }
}
