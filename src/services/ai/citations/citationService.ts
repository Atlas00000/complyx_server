export interface Citation {
  id: string;
  source: string;
  title: string;
  url?: string;
  section?: string;
  page?: string;
  relevance: number; // 0-1 relevance score
}

export interface CitationReference {
  citationId: string;
  text: string; // The text that references this citation
  startIndex?: number;
  endIndex?: number;
}

export interface AIResponseWithCitations {
  content: string;
  citations: Citation[];
  references: CitationReference[];
  confidence: number; // 0-100 confidence score
  sources: string[];
}

export interface ConfidenceScore {
  overall: number; // 0-100
  factors: {
    sourceQuality: number; // Quality of sources used
    answerCompleteness: number; // How complete the answer is
    factuality: number; // Likelihood answer is factual
    relevance: number; // Relevance to user's question
  };
}

/**
 * Citation Service
 * Handles citations, source linking, and confidence scoring for AI responses
 */
export class CitationService {
  /**
   * IFRS S1 & S2 official sources
   */
  private officialSources: Citation[] = [
    {
      id: 'ifrs-s1',
      source: 'IFRS Foundation',
      title: 'IFRS S1: General Requirements for Disclosure of Sustainability-related Financial Information',
      url: 'https://www.ifrs.org/issued-standards/ifrs-sustainability-standards/',
      section: 'S1',
      relevance: 1.0,
    },
    {
      id: 'ifrs-s2',
      source: 'IFRS Foundation',
      title: 'IFRS S2: Climate-related Disclosures',
      url: 'https://www.ifrs.org/issued-standards/ifrs-sustainability-standards/',
      section: 'S2',
      relevance: 1.0,
    },
    {
      id: 'ifrs-s1-governance',
      source: 'IFRS S1',
      title: 'Governance Requirements (S1-1)',
      section: 'S1-1',
      relevance: 0.9,
    },
    {
      id: 'ifrs-s1-strategy',
      source: 'IFRS S1',
      title: 'Strategy Requirements (S1-2)',
      section: 'S1-2',
      relevance: 0.9,
    },
    {
      id: 'ifrs-s1-risk',
      source: 'IFRS S1',
      title: 'Risk Management Requirements (S1-3)',
      section: 'S1-3',
      relevance: 0.9,
    },
    {
      id: 'ifrs-s1-metrics',
      source: 'IFRS S1',
      title: 'Metrics and Targets Requirements (S1-4)',
      section: 'S1-4',
      relevance: 0.9,
    },
    {
      id: 'ifrs-s2-governance',
      source: 'IFRS S2',
      title: 'Governance Requirements (S2-1)',
      section: 'S2-1',
      relevance: 0.9,
    },
    {
      id: 'ifrs-s2-strategy',
      source: 'IFRS S2',
      title: 'Strategy Requirements (S2-2)',
      section: 'S2-2',
      relevance: 0.9,
    },
    {
      id: 'ifrs-s2-risk',
      source: 'IFRS S2',
      title: 'Risk Management Requirements (S2-3)',
      section: 'S2-3',
      relevance: 0.9,
    },
    {
      id: 'ifrs-s2-metrics',
      source: 'IFRS S2',
      title: 'Metrics and Targets Requirements (S2-4)',
      section: 'S2-4',
      relevance: 0.9,
    },
    {
      id: 'tcfd',
      source: 'TCFD',
      title: 'Task Force on Climate-related Financial Disclosures',
      url: 'https://www.fsb-tcfd.org/',
      relevance: 0.8,
    },
  ];

  /**
   * Extract citations from AI response text
   */
  extractCitations(responseText: string, mentionedRequirements?: string[]): Citation[] {
    const citations: Citation[] = [];

    // Check for requirement mentions (e.g., "S1-1", "S2-2")
    const requirementPattern = /(S[12]-\d+[a-z]?)/gi;
    const matches = responseText.match(requirementPattern);

    if (matches) {
      for (const match of matches) {
        const citation = this.findCitationBySection(match);
        if (citation && !citations.find(c => c.id === citation.id)) {
          citations.push(citation);
        }
      }
    }

    // Add citations for mentioned requirements
    if (mentionedRequirements) {
      for (const req of mentionedRequirements) {
        const citation = this.findCitationBySection(req);
        if (citation && !citations.find(c => c.id === citation.id)) {
          citations.push(citation);
        }
      }
    }

    // Always include base IFRS S1 or S2 citation if relevant
    if (responseText.includes('IFRS S1') || responseText.includes('S1')) {
      const s1Citation = this.officialSources.find(c => c.id === 'ifrs-s1');
      if (s1Citation && !citations.find(c => c.id === s1Citation.id)) {
        citations.push(s1Citation);
      }
    }

    if (responseText.includes('IFRS S2') || responseText.includes('S2')) {
      const s2Citation = this.officialSources.find(c => c.id === 'ifrs-s2');
      if (s2Citation && !citations.find(c => c.id === s2Citation.id)) {
        citations.push(s2Citation);
      }
    }

    return citations;
  }

  /**
   * Find citation by section code
   */
  private findCitationBySection(section: string): Citation | undefined {
    return this.officialSources.find(c => c.section === section);
  }

  /**
   * Add citations to AI response
   */
  addCitationsToResponse(
    responseText: string,
    citations: Citation[]
  ): AIResponseWithCitations {
    // Create citation references in the text
    const references: CitationReference[] = [];
    let annotatedText = responseText;

    // Add citation markers in text
    citations.forEach((citation, index) => {
      const marker = `[${index + 1}]`;
      // Simple approach: add citation marker at end of sentences mentioning the requirement
      if (citation.section && responseText.includes(citation.section)) {
        references.push({
          citationId: citation.id,
          text: citation.section,
        });
      }
    });

    return {
      content: annotatedText,
      citations,
      references,
      confidence: this.calculateConfidence(responseText, citations),
      sources: citations.map(c => c.source),
    };
  }

  /**
   * Calculate confidence score for AI response
   */
  calculateConfidence(
    responseText: string,
    citations: Citation[]
  ): ConfidenceScore {
    // Factor 1: Source Quality (0-100)
    // Official IFRS sources = high quality
    const officialCitations = citations.filter(c => 
      c.source === 'IFRS Foundation' || c.source.startsWith('IFRS')
    );
    const sourceQuality = citations.length > 0
      ? (officialCitations.length / citations.length) * 100
      : 50; // Default if no citations

    // Factor 2: Answer Completeness (0-100)
    // Longer, more detailed answers = more complete
    const wordCount = responseText.split(/\s+/).length;
    const answerCompleteness = Math.min(100, (wordCount / 50) * 100); // 50 words = 100%

    // Factor 3: Factuality (0-100)
    // Based on citation count and quality
    const factuality = citations.length > 0
      ? Math.min(100, 60 + (citations.length * 10)) // Base 60, +10 per citation
      : 50; // Lower if no citations

    // Factor 4: Relevance (0-100)
    // Based on requirement mentions and specificity
    const requirementMentions = (responseText.match(/(S[12]-\d+)/g) || []).length;
    const relevance = Math.min(100, 50 + (requirementMentions * 15)); // Base 50, +15 per mention

    // Overall confidence: weighted average
    const overall = Math.round(
      (sourceQuality * 0.3) +
      (answerCompleteness * 0.2) +
      (factuality * 0.3) +
      (relevance * 0.2)
    );

    return {
      overall,
      factors: {
        sourceQuality: Math.round(sourceQuality),
        answerCompleteness: Math.round(answerCompleteness),
        factuality: Math.round(factuality),
        relevance: Math.round(relevance),
      },
    };
  }

  /**
   * Format citations for display
   */
  formatCitations(citations: Citation[]): string {
    if (citations.length === 0) {
      return '';
    }

    let formatted = '\n\n**Sources:**\n';
    citations.forEach((citation, index) => {
      formatted += `${index + 1}. ${citation.title}`;
      if (citation.section) {
        formatted += ` (${citation.section})`;
      }
      if (citation.url) {
        formatted += ` - ${citation.url}`;
      }
      formatted += '\n';
    });

    return formatted;
  }

  /**
   * Get all available sources
   */
  getAllSources(): Citation[] {
    return this.officialSources;
  }

  /**
   * Get source by ID
   */
  getSourceById(id: string): Citation | undefined {
    return this.officialSources.find(c => c.id === id);
  }

  /**
   * Check if response needs citations
   */
  needsCitations(responseText: string): boolean {
    // Check if response mentions IFRS requirements or standards
    const hasRequirementMention = /(S[12]-\d+|IFRS S[12])/i.test(responseText);
    const hasTechnicalContent = /(requirement|standard|compliance|disclosure|governance|strategy|risk|metrics)/i.test(responseText);
    
    return hasRequirementMention || hasTechnicalContent;
  }
}
