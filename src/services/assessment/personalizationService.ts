/**
 * Personalization Service
 * Provides industry-specific and entity type awareness for assessments
 */

import type { QuestionNode } from './assessmentFlowEngine';

export type IndustryType =
  | 'manufacturing'
  | 'financial-services'
  | 'technology'
  | 'energy'
  | 'retail'
  | 'healthcare'
  | 'real-estate'
  | 'transportation'
  | 'agriculture'
  | 'mining'
  | 'construction'
  | 'telecommunications'
  | 'hospitality'
  | 'utilities'
  | 'other';

export type EntityType = 'public-company' | 'private-company' | 'non-profit' | 'government' | 'partnership' | 'sole-proprietorship';

export interface PersonalizationProfile {
  industry?: IndustryType;
  entityType?: EntityType;
  size?: 'sme' | 'mid-size' | 'enterprise' | 'large-enterprise';
  geography?: string; // Country/jurisdiction
  revenue?: number; // Annual revenue
  employeeCount?: number;
}

export interface IndustryConfig {
  industry: IndustryType;
  name: string;
  description: string;
  priorityCategories: string[]; // Categories to prioritize
  relevantCategories: string[]; // All relevant categories
  specificQuestions?: string[]; // Question IDs specific to this industry
  skipCategories?: string[]; // Categories to skip for this industry
}

export interface EntityTypeConfig {
  entityType: EntityType;
  name: string;
  description: string;
  applicableStandards: ('S1' | 'S2')[];
  requiredCategories: string[];
  optionalCategories: string[];
  specialConsiderations: string[];
}

/**
 * Personalization Service
 * Handles industry-specific and entity type awareness
 */
export class PersonalizationService {
  private industryConfigs: Map<IndustryType, IndustryConfig> = new Map();
  private entityTypeConfigs: Map<EntityType, EntityTypeConfig> = new Map();

  constructor() {
    this.initializeIndustryConfigs();
    this.initializeEntityTypeConfigs();
  }

  /**
   * Initialize industry configurations
   */
  private initializeIndustryConfigs(): void {
    // Manufacturing
    this.industryConfigs.set('manufacturing', {
      industry: 'manufacturing',
      name: 'Manufacturing',
      description: 'Manufacturing and industrial production',
      priorityCategories: ['Governance', 'Risk Management', 'Metrics'],
      relevantCategories: ['Governance', 'Strategy', 'Risk Management', 'Metrics', 'Targets'],
      skipCategories: [],
    });

    // Financial Services
    this.industryConfigs.set('financial-services', {
      industry: 'financial-services',
      name: 'Financial Services',
      description: 'Banking, insurance, and financial institutions',
      priorityCategories: ['Governance', 'Risk Management', 'Disclosures'],
      relevantCategories: ['Governance', 'Strategy', 'Risk Management', 'Metrics', 'Targets', 'Disclosures'],
      skipCategories: [],
    });

    // Energy
    this.industryConfigs.set('energy', {
      industry: 'energy',
      name: 'Energy',
      description: 'Oil, gas, renewable energy',
      priorityCategories: ['Climate', 'Emissions', 'Risk Management'],
      relevantCategories: ['Governance', 'Strategy', 'Risk Management', 'Climate', 'Emissions', 'Metrics', 'Targets'],
      skipCategories: [],
    });

    // Technology
    this.industryConfigs.set('technology', {
      industry: 'technology',
      name: 'Technology',
      description: 'Software, hardware, and technology services',
      priorityCategories: ['Strategy', 'Value Chain', 'Metrics'],
      relevantCategories: ['Governance', 'Strategy', 'Value Chain', 'Metrics', 'Targets'],
      skipCategories: [],
    });

    // Retail
    this.industryConfigs.set('retail', {
      industry: 'retail',
      name: 'Retail',
      description: 'Retail and consumer goods',
      priorityCategories: ['Value Chain', 'Supply Chain', 'Metrics'],
      relevantCategories: ['Governance', 'Strategy', 'Value Chain', 'Supply Chain', 'Metrics', 'Targets'],
      skipCategories: [],
    });

    // Default/Other
    this.industryConfigs.set('other', {
      industry: 'other',
      name: 'Other Industries',
      description: 'General industry configuration',
      priorityCategories: ['Governance', 'Strategy', 'Risk Management', 'Metrics'],
      relevantCategories: ['Governance', 'Strategy', 'Risk Management', 'Metrics', 'Targets'],
      skipCategories: [],
    });
  }

  /**
   * Initialize entity type configurations
   */
  private initializeEntityTypeConfigs(): void {
    // Public Company
    this.entityTypeConfigs.set('public-company', {
      entityType: 'public-company',
      name: 'Public Company',
      description: 'Publicly traded company with reporting obligations',
      applicableStandards: ['S1', 'S2'],
      requiredCategories: ['Governance', 'Strategy', 'Risk Management', 'Metrics', 'Targets', 'Disclosures'],
      optionalCategories: [],
      specialConsiderations: [
        'Enhanced disclosure requirements',
        'Regulatory compliance obligations',
        'Stakeholder reporting expectations',
      ],
    });

    // Private Company
    this.entityTypeConfigs.set('private-company', {
      entityType: 'private-company',
      name: 'Private Company',
      description: 'Privately held company',
      applicableStandards: ['S1', 'S2'],
      requiredCategories: ['Governance', 'Strategy', 'Risk Management', 'Metrics'],
      optionalCategories: ['Enhanced Disclosures', 'Stakeholder Reporting'],
      specialConsiderations: [
        'May have voluntary reporting',
        'May be subject to future requirements',
        'Consider stakeholder expectations',
      ],
    });

    // Non-Profit Organization
    this.entityTypeConfigs.set('non-profit', {
      entityType: 'non-profit',
      name: 'Non-Profit Organization',
      description: 'Non-profit or charitable organization',
      applicableStandards: ['S1'],
      requiredCategories: ['Governance', 'Strategy', 'Risk Management'],
      optionalCategories: ['Metrics', 'Targets', 'Disclosures'],
      specialConsiderations: [
        'Focus on governance and mission alignment',
        'May have voluntary sustainability reporting',
        'Consider donor and stakeholder expectations',
      ],
    });

    // Government
    this.entityTypeConfigs.set('government', {
      entityType: 'government',
      name: 'Government Entity',
      description: 'Government or public sector organization',
      applicableStandards: ['S1'],
      requiredCategories: ['Governance', 'Strategy', 'Risk Management'],
      optionalCategories: ['Metrics', 'Targets'],
      specialConsiderations: [
        'Public accountability requirements',
        'Transparency and disclosure expectations',
        'May have specific regulatory frameworks',
      ],
    });
  }

  /**
   * Get industry configuration
   */
  getIndustryConfig(industry: IndustryType): IndustryConfig {
    return this.industryConfigs.get(industry) || this.industryConfigs.get('other')!;
  }

  /**
   * Get entity type configuration
   */
  getEntityTypeConfig(entityType: EntityType): EntityTypeConfig {
    const config = this.entityTypeConfigs.get(entityType);
    if (!config) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }
    return config;
  }

  /**
   * Personalize questions based on profile
   */
  personalizeQuestions(
    questions: QuestionNode[],
    profile: PersonalizationProfile
  ): QuestionNode[] {
    let personalized = questions;

    // Apply industry-specific filtering
    if (profile.industry) {
      personalized = this.applyIndustryFilter(personalized, profile.industry);
    }

    // Apply entity type filtering
    if (profile.entityType) {
      personalized = this.applyEntityTypeFilter(personalized, profile.entityType);
    }

    // Apply size-based filtering
    if (profile.size) {
      personalized = this.applySizeFilter(personalized, profile.size);
    }

    // Apply geographic filtering
    if (profile.geography) {
      personalized = this.applyGeographicFilter(personalized, profile.geography);
    }

    // Reorder by priority based on profile
    personalized = this.reorderByProfile(personalized, profile);

    return personalized;
  }

  /**
   * Apply industry-specific filtering
   */
  private applyIndustryFilter(questions: QuestionNode[], industry: IndustryType): QuestionNode[] {
    const config = this.getIndustryConfig(industry);

    // Filter questions based on industry relevance
    const filtered = questions.filter(question => {
      // Skip categories not relevant to industry
      if (config.skipCategories && config.skipCategories.includes(question.category)) {
        return false;
      }

      // Prioritize relevant categories
      if (config.relevantCategories.includes(question.category)) {
        return true;
      }

      // Include all questions by default
      return true;
    });

    return filtered;
  }

  /**
   * Apply entity type filtering
   */
  private applyEntityTypeFilter(questions: QuestionNode[], entityType: EntityType): QuestionNode[] {
    const config = this.getEntityTypeConfig(entityType);

    // Filter questions based on entity type requirements
    return questions.filter(question => {
      // Check if question category is required for entity type
      if (config.requiredCategories.includes(question.category)) {
        return true;
      }

      // Include optional categories
      if (config.optionalCategories.includes(question.category)) {
        return true;
      }

      // Exclude categories not relevant to entity type (basic check)
      // In production, this would be more sophisticated
      return true;
    });
  }

  /**
   * Apply size-based filtering
   */
  private applySizeFilter(questions: QuestionNode[], size: 'sme' | 'mid-size' | 'enterprise' | 'large-enterprise'): QuestionNode[] {
    // Size-based filtering: SMEs may skip some complex questions
    return questions.filter(question => {
      // For SMEs, skip highly complex questions
      if (size === 'sme' && question.priority === 'low' && question.category.includes('Advanced')) {
        return false;
      }

      return true;
    });
  }

  /**
   * Apply geographic filtering
   */
  private applyGeographicFilter(questions: QuestionNode[], _geography: string): QuestionNode[] {
    // Geographic filtering: Some questions may be jurisdiction-specific
    // For now, include all questions (could be enhanced with jurisdiction-specific logic)
    return questions;
  }

  /**
   * Reorder questions based on personalization profile
   */
  private reorderByProfile(questions: QuestionNode[], profile: PersonalizationProfile): QuestionNode[] {
    return questions.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Industry priority boost
      if (profile.industry) {
        const industryConfig = this.getIndustryConfig(profile.industry);
        if (industryConfig.priorityCategories.includes(a.category)) {
          scoreA += 10;
        }
        if (industryConfig.priorityCategories.includes(b.category)) {
          scoreB += 10;
        }
      }

      // Entity type priority boost
      if (profile.entityType) {
        const entityConfig = this.getEntityTypeConfig(profile.entityType);
        if (entityConfig.requiredCategories.includes(a.category)) {
          scoreA += 5;
        }
        if (entityConfig.requiredCategories.includes(b.category)) {
          scoreB += 5;
        }
      }

      // Original priority
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      scoreA += priorityOrder[a.priority];
      scoreB += priorityOrder[b.priority];

      return scoreB - scoreA;
    });
  }

  /**
   * Get personalized question set
   */
  getPersonalizedQuestionSet(profile: PersonalizationProfile): {
    categories: string[];
    priorityOrder: string[];
    estimatedCount: number;
  } {
    let categories: string[] = [];
    let priorityOrder: string[] = [];

    // Get industry-specific categories
    if (profile.industry) {
      const industryConfig = this.getIndustryConfig(profile.industry);
      categories = industryConfig.relevantCategories;
      priorityOrder = industryConfig.priorityCategories;
    }

    // Override with entity type requirements
    if (profile.entityType) {
      const entityConfig = this.getEntityTypeConfig(profile.entityType);
      categories = [...new Set([...categories, ...entityConfig.requiredCategories])];
      priorityOrder = [...new Set([...entityConfig.requiredCategories, ...priorityOrder])];
    }

    // Estimate question count based on profile
    let estimatedCount = 30; // Default
    if (profile.size === 'sme') {
      estimatedCount = 20;
    } else if (profile.size === 'enterprise' || profile.size === 'large-enterprise') {
      estimatedCount = 60;
    }

    // Adjust based on entity type
    if (profile.entityType === 'public-company') {
      estimatedCount += 20; // More questions for public companies
    } else if (profile.entityType === 'non-profit') {
      estimatedCount -= 10; // Fewer questions for non-profits
    }

    return {
      categories: [...new Set(categories)],
      priorityOrder: [...new Set(priorityOrder)],
      estimatedCount,
    };
  }

  /**
   * Detect industry from context (simplified)
   */
  detectIndustry(context: string): IndustryType {
    const contextLower = context.toLowerCase();

    const industryKeywords: Record<IndustryType, string[]> = {
      manufacturing: ['manufacturing', 'production', 'factory', 'industrial'],
      'financial-services': ['bank', 'finance', 'insurance', 'financial', 'investment'],
      technology: ['software', 'technology', 'tech', 'IT', 'digital'],
      energy: ['energy', 'oil', 'gas', 'renewable', 'power', 'electricity'],
      retail: ['retail', 'store', 'shopping', 'consumer goods'],
      healthcare: ['healthcare', 'hospital', 'medical', 'health'],
      'real-estate': ['real estate', 'property', 'construction'],
      transportation: ['transport', 'logistics', 'shipping', 'aviation'],
      agriculture: ['agriculture', 'farming', 'food production'],
      mining: ['mining', 'mineral', 'extraction'],
      construction: ['construction', 'building', 'infrastructure'],
      telecommunications: ['telecom', 'communication', 'network'],
      hospitality: ['hospitality', 'hotel', 'tourism', 'restaurant'],
      utilities: ['utility', 'water', 'waste', 'sewage'],
      other: [],
    };

    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      for (const keyword of keywords) {
        if (contextLower.includes(keyword)) {
          return industry as IndustryType;
        }
      }
    }

    return 'other';
  }

  /**
   * Detect entity type from context (simplified)
   */
  detectEntityType(context: string): EntityType {
    const contextLower = context.toLowerCase();

    if (contextLower.includes('public') && (contextLower.includes('company') || contextLower.includes('traded'))) {
      return 'public-company';
    }
    if (contextLower.includes('private') && contextLower.includes('company')) {
      return 'private-company';
    }
    if (contextLower.includes('non-profit') || contextLower.includes('nonprofit') || contextLower.includes('charity')) {
      return 'non-profit';
    }
    if (contextLower.includes('government') || contextLower.includes('public sector')) {
      return 'government';
    }

    return 'private-company'; // Default
  }

  /**
   * Size-based customization: Adjust questions based on organization size
   */
  customizeBySize(
    questions: QuestionNode[],
    size: 'sme' | 'mid-size' | 'enterprise' | 'large-enterprise',
    profile?: PersonalizationProfile
  ): QuestionNode[] {
    const customized = questions.map(question => {
      // For SMEs, simplify complex questions
      if (size === 'sme') {
        return this.simplifyQuestionForSME(question);
      }

      // For large enterprises, may include additional complexity
      if (size === 'enterprise' || size === 'large-enterprise') {
        return this.enhanceQuestionForEnterprise(question, profile);
      }

      return question;
    });

    // Filter out questions not relevant to size
    return customized.filter(question => this.isRelevantForSize(question, size));
  }

  /**
   * Simplify question for SME
   */
  private simplifyQuestionForSME(question: QuestionNode): QuestionNode {
    // Simplify complex questions for SMEs
    if (question.question.length > 200) {
      // Shorten very long questions
      const simplified: QuestionNode = {
        ...question,
        question: this.createSimplifiedVersion(question.question),
      };
      return simplified;
    }
    return question;
  }

  /**
   * Enhance question for enterprise
   */
  private enhanceQuestionForEnterprise(question: QuestionNode, _profile?: PersonalizationProfile): QuestionNode {
    // Could add enterprise-specific considerations
    // For now, return as-is
    return question;
  }

  /**
   * Check if question is relevant for organization size
   */
  private isRelevantForSize(question: QuestionNode, size: 'sme' | 'mid-size' | 'enterprise' | 'large-enterprise'): boolean {
    const questionLower = question.question.toLowerCase();

    // SMEs may skip advanced/complex questions
    if (size === 'sme') {
      if (questionLower.includes('complex') || questionLower.includes('advanced') || questionLower.includes('sophisticated')) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create simplified version of question for SMEs
   */
  private createSimplifiedVersion(question: string): string {
    // Simple heuristic: extract main question part
    const sentences = question.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 1) {
      // Return first sentence (main question)
      return sentences[0].trim() + '?';
    }
    return question;
  }

  /**
   * Geographic customization: Adjust questions based on jurisdiction
   */
  customizeByGeography(
    questions: QuestionNode[],
    geography: string,
    _profile?: PersonalizationProfile
  ): QuestionNode[] {
    // Identify jurisdiction-specific requirements
    const jurisdictionConfig = this.getJurisdictionConfig(geography);

    // Filter and prioritize based on jurisdiction
    return questions.filter(question => {
      // Check if question is required in jurisdiction
      if (jurisdictionConfig.requiredCategories && 
          jurisdictionConfig.requiredCategories.includes(question.category)) {
        return true;
      }

      // Check if question should be skipped in jurisdiction
      if (jurisdictionConfig.skipCategories && 
          jurisdictionConfig.skipCategories.includes(question.category)) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      // Prioritize required categories
      const aRequired = jurisdictionConfig.requiredCategories?.includes(a.category) ? 1 : 0;
      const bRequired = jurisdictionConfig.requiredCategories?.includes(b.category) ? 1 : 0;
      return bRequired - aRequired;
    });
  }

  /**
   * Get jurisdiction configuration
   */
  private getJurisdictionConfig(geography: string): {
    requiredCategories?: string[];
    skipCategories?: string[];
    specialRequirements?: string[];
  } {
    const geoLower = geography.toLowerCase();

    // Nigeria-specific requirements
    if (geoLower.includes('nigeria') || geoLower.includes('ng')) {
      return {
        requiredCategories: ['Governance', 'Risk Management', 'Disclosures', 'FRC Compliance'],
        skipCategories: [],
        specialRequirements: ['FRC Act compliance', 'Nigerian regulatory framework'],
      };
    }

    // EU-specific requirements
    if (geoLower.includes('eu') || geoLower.includes('europe') || geoLower.includes('european')) {
      return {
        requiredCategories: ['Governance', 'Strategy', 'Risk Management', 'Metrics', 'CSRD Compliance'],
        skipCategories: [],
        specialRequirements: ['CSRD alignment', 'EU Taxonomy'],
      };
    }

    // US-specific requirements
    if (geoLower.includes('us') || geoLower.includes('usa') || geoLower.includes('united states')) {
      return {
        requiredCategories: ['Governance', 'Risk Management', 'SEC Disclosures'],
        skipCategories: [],
        specialRequirements: ['SEC climate disclosure rules', 'State-specific requirements'],
      };
    }

    // UK-specific requirements
    if (geoLower.includes('uk') || geoLower.includes('united kingdom') || geoLower.includes('britain')) {
      return {
        requiredCategories: ['Governance', 'Strategy', 'Risk Management', 'TCFD Compliance'],
        skipCategories: [],
        specialRequirements: ['TCFD alignment', 'UK Companies Act'],
      };
    }

    // Default: IFRS S1/S2 requirements
    return {
      requiredCategories: ['Governance', 'Strategy', 'Risk Management', 'Metrics'],
      skipCategories: [],
    };
  }

  /**
   * Apply full personalization based on profile
   */
  applyFullPersonalization(
    questions: QuestionNode[],
    profile: PersonalizationProfile
  ): QuestionNode[] {
    let personalized = questions;

    // 1. Industry-specific customization
    if (profile.industry) {
      personalized = this.personalizeQuestions(personalized, profile);
    }

    // 2. Entity type customization
    if (profile.entityType) {
      personalized = this.applyEntityTypeFilter(personalized, profile.entityType);
    }

    // 3. Size-based customization
    if (profile.size) {
      personalized = this.customizeBySize(personalized, profile.size, profile);
    }

    // 4. Geographic customization
    if (profile.geography) {
      personalized = this.customizeByGeography(personalized, profile.geography, profile);
    }

    // 5. Reorder by priority
    personalized = this.reorderByProfile(personalized, profile);

    return personalized;
  }

  /**
   * Generate personalized assessment configuration
   */
  generatePersonalizedConfig(profile: PersonalizationProfile): {
    questionCount: {
      min: number;
      max: number;
      target: number;
    };
    estimatedDuration: number; // minutes
    focusAreas: string[];
    priorityCategories: string[];
  } {
    const questionSet = this.getPersonalizedQuestionSet(profile);

    // Calculate question count based on profile
    let target = questionSet.estimatedCount;
    let min = Math.floor(target * 0.7);
    let max = Math.floor(target * 1.3);

    // Adjust based on size
    if (profile.size === 'sme') {
      target = Math.floor(target * 0.7);
      min = Math.floor(target * 0.7);
      max = Math.floor(target * 1.2);
    } else if (profile.size === 'enterprise' || profile.size === 'large-enterprise') {
      target = Math.floor(target * 1.2);
      min = Math.floor(target * 0.8);
      max = Math.floor(target * 1.5);
    }

    // Calculate estimated duration (average 1-2 minutes per question)
    const avgTimePerQuestion = profile.size === 'sme' ? 1.2 : profile.size === 'enterprise' ? 2 : 1.5;
    const estimatedDuration = Math.ceil(target * avgTimePerQuestion);

    return {
      questionCount: {
        min,
        max,
        target,
      },
      estimatedDuration,
      focusAreas: questionSet.priorityOrder,
      priorityCategories: questionSet.priorityOrder,
    };
  }

  /**
   * Detect size from context (simplified)
   */
  detectSize(context: string, profile?: PersonalizationProfile): 'sme' | 'mid-size' | 'enterprise' | 'large-enterprise' {
    // Use revenue or employee count if available
    if (profile?.revenue) {
      if (profile.revenue < 10_000_000) {
        return 'sme';
      } else if (profile.revenue < 100_000_000) {
        return 'mid-size';
      } else if (profile.revenue < 1_000_000_000) {
        return 'enterprise';
      } else {
        return 'large-enterprise';
      }
    }

    if (profile?.employeeCount) {
      if (profile.employeeCount < 50) {
        return 'sme';
      } else if (profile.employeeCount < 250) {
        return 'mid-size';
      } else if (profile.employeeCount < 1000) {
        return 'enterprise';
      } else {
        return 'large-enterprise';
      }
    }

    // Fallback: detect from context
    const contextLower = context.toLowerCase();
    if (contextLower.includes('sme') || contextLower.includes('small') || contextLower.includes('startup')) {
      return 'sme';
    }
    if (contextLower.includes('enterprise') || contextLower.includes('large') || contextLower.includes('corporation')) {
      return 'enterprise';
    }

    return 'mid-size'; // Default
  }
}
