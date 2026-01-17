export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'general' | 's1' | 's2' | 'governance' | 'strategy' | 'risk' | 'metrics' | 'compliance' | 'implementation';
  tags: string[];
  relatedQuestions?: string[]; // IDs of related questions
  source?: string;
  url?: string;
}

export interface Resource {
  id: string;
  title: string;
  description: string;
  type: 'document' | 'guide' | 'video' | 'article' | 'standard' | 'tool';
  url: string;
  category: 'general' | 's1' | 's2' | 'governance' | 'strategy' | 'risk' | 'metrics' | 'compliance' | 'implementation';
  tags: string[];
  source?: string;
  author?: string;
  publishedDate?: string;
}

export interface FAQSearchResult {
  faqs: FAQItem[];
  totalResults: number;
  query: string;
}

export interface ResourceSearchResult {
  resources: Resource[];
  totalResults: number;
  query: string;
}

/**
 * FAQ and Resources Service
 * Manages FAQ items and resource library
 */
export class FAQService {
  private faqs: Map<string, FAQItem> = new Map();
  private resources: Map<string, Resource> = new Map();

  constructor() {
    this.initializeFAQs();
    this.initializeResources();
  }

  /**
   * Get FAQ by ID
   */
  getFAQ(id: string): FAQItem | null {
    return this.faqs.get(id) || null;
  }

  /**
   * Get all FAQs
   */
  getAllFAQs(category?: FAQItem['category']): FAQItem[] {
    const allFAQs = Array.from(this.faqs.values());
    if (category) {
      return allFAQs.filter(faq => faq.category === category);
    }
    return allFAQs;
  }

  /**
   * Search FAQs
   */
  searchFAQs(query: string, category?: FAQItem['category']): FAQSearchResult {
    const queryLower = query.toLowerCase();
    let faqs = Array.from(this.faqs.values());

    // Filter by category if specified
    if (category) {
      faqs = faqs.filter(faq => faq.category === category);
    }

    // Search in questions and answers
    const results = faqs.filter(faq => {
      const questionMatch = faq.question.toLowerCase().includes(queryLower);
      const answerMatch = faq.answer.toLowerCase().includes(queryLower);
      const tagMatch = faq.tags.some(tag => tag.toLowerCase().includes(queryLower));
      return questionMatch || answerMatch || tagMatch;
    });

    return {
      faqs: results,
      totalResults: results.length,
      query,
    };
  }

  /**
   * Get related FAQs
   */
  getRelatedFAQs(faqId: string, limit: number = 5): FAQItem[] {
    const faq = this.getFAQ(faqId);
    if (!faq || !faq.relatedQuestions) {
      return [];
    }

    const related: FAQItem[] = [];
    for (const relatedId of faq.relatedQuestions.slice(0, limit)) {
      const relatedFAQ = this.getFAQ(relatedId);
      if (relatedFAQ) {
        related.push(relatedFAQ);
      }
    }

    return related;
  }

  /**
   * Get resource by ID
   */
  getResource(id: string): Resource | null {
    return this.resources.get(id) || null;
  }

  /**
   * Get all resources
   */
  getAllResources(category?: Resource['category'], type?: Resource['type']): Resource[] {
    let resources = Array.from(this.resources.values());

    if (category) {
      resources = resources.filter(res => res.category === category);
    }

    if (type) {
      resources = resources.filter(res => res.type === type);
    }

    return resources;
  }

  /**
   * Search resources
   */
  searchResources(query: string, category?: Resource['category'], type?: Resource['type']): ResourceSearchResult {
    const queryLower = query.toLowerCase();
    let resources = Array.from(this.resources.values());

    // Filter by category if specified
    if (category) {
      resources = resources.filter(res => res.category === category);
    }

    // Filter by type if specified
    if (type) {
      resources = resources.filter(res => res.type === type);
    }

    // Search in title, description, and tags
    const results = resources.filter(res => {
      const titleMatch = res.title.toLowerCase().includes(queryLower);
      const descriptionMatch = res.description.toLowerCase().includes(queryLower);
      const tagMatch = res.tags.some(tag => tag.toLowerCase().includes(queryLower));
      return titleMatch || descriptionMatch || tagMatch;
    });

    return {
      resources: results,
      totalResults: results.length,
      query,
    };
  }

  /**
   * Initialize default FAQs
   */
  private initializeFAQs(): void {
    const defaultFAQs: FAQItem[] = [
      {
        id: 'faq-1',
        question: 'What is IFRS S1?',
        answer: 'IFRS S1 (General Requirements for Disclosure of Sustainability-related Financial Information) is a standard that establishes general requirements for disclosing sustainability-related financial information. It covers governance, strategy, risk management, and metrics/targets.',
        category: 'general',
        tags: ['IFRS S1', 'sustainability', 'disclosure', 'basics'],
      },
      {
        id: 'faq-2',
        question: 'What is IFRS S2?',
        answer: 'IFRS S2 (Climate-related Disclosures) is a standard that focuses specifically on climate-related disclosures. It requires entities to disclose information about climate-related risks and opportunities, including governance, strategy, risk management, and metrics/targets related to climate.',
        category: 's2',
        tags: ['IFRS S2', 'climate', 'disclosure', 'basics'],
      },
      {
        id: 'faq-3',
        question: 'Who needs to comply with IFRS S1 and S2?',
        answer: 'IFRS S1 and S2 apply to entities that are required to use IFRS Standards in their financial reporting. This typically includes publicly listed companies and other entities that have adopted IFRS Standards. The standards may also be adopted voluntarily by other entities.',
        category: 'compliance',
        tags: ['compliance', 'scope', 'applicability'],
      },
      {
        id: 'faq-4',
        question: 'What are the key governance requirements under IFRS S1?',
        answer: 'IFRS S1 requires disclosure about governance processes, controls, and procedures used to monitor and manage sustainability-related risks and opportunities. This includes information about board oversight, management accountability, and governance structures.',
        category: 'governance',
        tags: ['governance', 'S1', 'requirements'],
      },
      {
        id: 'faq-5',
        question: 'What metrics are required under IFRS S2?',
        answer: 'IFRS S2 requires disclosure of climate-related metrics, including greenhouse gas emissions (Scope 1, 2, and 3), climate-related targets, and progress toward those targets. Entities must also disclose how metrics are calculated and any assumptions used.',
        category: 'metrics',
        tags: ['metrics', 'S2', 'climate', 'emissions'],
      },
    ];

    for (const faq of defaultFAQs) {
      this.faqs.set(faq.id, faq);
    }
  }

  /**
   * Initialize default resources
   */
  private initializeResources(): void {
    const defaultResources: Resource[] = [
      {
        id: 'res-1',
        title: 'IFRS S1 Official Standard',
        description: 'The official IFRS S1 standard document from the IFRS Foundation.',
        type: 'standard',
        url: 'https://www.ifrs.org/issued-standards/ifrs-sustainability-standards/',
        category: 's1',
        tags: ['IFRS S1', 'official', 'standard'],
        source: 'IFRS Foundation',
      },
      {
        id: 'res-2',
        title: 'IFRS S2 Official Standard',
        description: 'The official IFRS S2 standard document from the IFRS Foundation.',
        type: 'standard',
        url: 'https://www.ifrs.org/issued-standards/ifrs-sustainability-standards/',
        category: 's2',
        tags: ['IFRS S2', 'official', 'standard'],
        source: 'IFRS Foundation',
      },
      {
        id: 'res-3',
        title: 'TCFD Recommendations',
        description: 'Task Force on Climate-related Financial Disclosures recommendations and guidance.',
        type: 'guide',
        url: 'https://www.fsb-tcfd.org/',
        category: 's2',
        tags: ['TCFD', 'climate', 'guidance'],
        source: 'TCFD',
      },
    ];

    for (const resource of defaultResources) {
      this.resources.set(resource.id, resource);
    }
  }
}
