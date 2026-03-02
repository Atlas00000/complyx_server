/**
 * Assessment question block shape for API responses (rich message blocks).
 */

export type AssessmentQuestionType = 'multiple_choice' | 'yes_no' | 'scale' | 'text';

export interface AssessmentOption {
  value: string;
  label?: string;
  score?: number;
}

export interface AssessmentQuestionBlockPayload {
  questionId: string;
  text: string;
  questionType: AssessmentQuestionType;
  categoryName?: string;
  options?: AssessmentOption[];
  scaleMin?: number;
  scaleMax?: number;
}

export interface AssessmentQuestionBlock {
  type: 'assessment_question';
  payload: AssessmentQuestionBlockPayload;
}
