import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface QuestionData {
  text: string;
  type: string;
  options?: string;
  ifrsStandard: string;
  requirement?: string;
  weight: number;
  order: number;
  phase: string; // quick, detailed, followup
  skipLogic?: string;
}

const questionCategories = [
  { name: 'governance', description: 'Governance structure and oversight' },
  { name: 'strategy', description: 'Strategy and business model' },
  { name: 'risk', description: 'Risk management and assessment' },
  { name: 'metrics', description: 'Metrics, targets, and disclosures' },
];

// IFRS S1 Questions (50+)
const ifrsS1Questions: QuestionData[] = [
  // Governance Category - Phase 1 (Quick): 2 questions
  {
    text: 'Does your organization have a board or governing body responsible for oversight of sustainability-related matters?',
    type: 'yes_no',
    ifrsStandard: 'S1',
    requirement: 'S1-1: Governance',
    weight: 1.5,
    order: 1,
    phase: 'quick',
  },
  {
    text: 'How does the board integrate sustainability considerations into strategic decision-making?',
    type: 'text',
    ifrsStandard: 'S1',
    requirement: 'S1-1: Governance',
    weight: 1.3,
    order: 2,
    phase: 'quick',
  },
  // Governance Category - Phase 2 (Detailed): 3 questions
  {
    text: 'How often does the board review sustainability-related risks and opportunities?',
    type: 'multiple_choice',
    options: JSON.stringify(['Monthly', 'Quarterly', 'Annually', 'As needed', 'Never']),
    ifrsStandard: 'S1',
    requirement: 'S1-1: Governance',
    weight: 1.0,
    order: 3,
    phase: 'detailed',
  },
  {
    text: 'Does your organization have a dedicated sustainability committee or working group?',
    type: 'yes_no',
    ifrsStandard: 'S1',
    requirement: 'S1-1: Governance',
    weight: 1.0,
    order: 4,
    phase: 'detailed',
  },
  {
    text: 'Are sustainability-related responsibilities clearly defined in management roles?',
    type: 'yes_no',
    ifrsStandard: 'S1',
    requirement: 'S1-1: Governance',
    weight: 1.2,
    order: 5,
    phase: 'detailed',
  },
  // Strategy Category - Phase 1 (Quick): 2 questions
  {
    text: 'Has your organization identified sustainability-related risks and opportunities that could affect its business model?',
    type: 'yes_no',
    ifrsStandard: 'S1',
    requirement: 'S1-2: Strategy',
    weight: 1.5,
    order: 6,
    phase: 'quick',
  },
  {
    text: 'How do sustainability-related risks and opportunities affect your organization\'s strategy and decision-making?',
    type: 'text',
    ifrsStandard: 'S1',
    requirement: 'S1-2: Strategy',
    weight: 1.4,
    order: 7,
    phase: 'quick',
  },
  // Strategy Category - Phase 2 (Detailed): 3 questions
  {
    text: 'What is your organization\'s approach to managing sustainability-related risks?',
    type: 'text',
    ifrsStandard: 'S1',
    requirement: 'S1-2: Strategy',
    weight: 1.3,
    order: 8,
    phase: 'detailed',
  },
  {
    text: 'How does your organization assess the resilience of its business model to sustainability-related risks?',
    type: 'text',
    ifrsStandard: 'S1',
    requirement: 'S1-2: Strategy',
    weight: 1.2,
    order: 9,
    phase: 'detailed',
  },
  {
    text: 'What sustainability-related opportunities has your organization identified?',
    type: 'text',
    ifrsStandard: 'S1',
    requirement: 'S1-2: Strategy',
    weight: 1.1,
    order: 10,
    phase: 'detailed',
  },
  // Risk Category - Phase 1 (Quick): 2 questions
  {
    text: 'Does your organization have a process to identify sustainability-related risks?',
    type: 'yes_no',
    ifrsStandard: 'S1',
    requirement: 'S1-3: Risk Management',
    weight: 1.5,
    order: 11,
    phase: 'quick',
  },
  {
    text: 'How are sustainability-related risks integrated into the overall risk management framework?',
    type: 'text',
    ifrsStandard: 'S1',
    requirement: 'S1-3: Risk Management',
    weight: 1.4,
    order: 12,
    phase: 'quick',
  },
  // Risk Category - Phase 2 (Detailed): 3 questions
  {
    text: 'How frequently are sustainability-related risks assessed?',
    type: 'multiple_choice',
    options: JSON.stringify(['Continuously', 'Monthly', 'Quarterly', 'Annually', 'Ad-hoc']),
    ifrsStandard: 'S1',
    requirement: 'S1-3: Risk Management',
    weight: 1.2,
    order: 13,
    phase: 'detailed',
  },
  {
    text: 'What risk management processes are in place for sustainability-related risks?',
    type: 'text',
    ifrsStandard: 'S1',
    requirement: 'S1-3: Risk Management',
    weight: 1.3,
    order: 14,
    phase: 'detailed',
  },
  {
    text: 'Does your organization have a risk appetite statement for sustainability-related risks?',
    type: 'yes_no',
    ifrsStandard: 'S1',
    requirement: 'S1-3: Risk Management',
    weight: 1.1,
    order: 15,
    phase: 'detailed',
  },
  // Metrics Category - Phase 1 (Quick): 2 questions
  {
    text: 'What metrics does your organization use to measure sustainability performance?',
    type: 'text',
    ifrsStandard: 'S1',
    requirement: 'S1-4: Metrics and Targets',
    weight: 1.5,
    order: 16,
    phase: 'quick',
  },
  {
    text: 'Are your sustainability metrics aligned with IFRS S1 requirements?',
    type: 'yes_no',
    ifrsStandard: 'S1',
    requirement: 'S1-4: Metrics and Targets',
    weight: 1.4,
    order: 17,
    phase: 'quick',
  },
  // Metrics Category - Phase 2 (Detailed): 3 questions
  {
    text: 'How frequently are sustainability metrics reported?',
    type: 'multiple_choice',
    options: JSON.stringify(['Monthly', 'Quarterly', 'Semi-annually', 'Annually']),
    ifrsStandard: 'S1',
    requirement: 'S1-4: Metrics and Targets',
    weight: 1.2,
    order: 18,
    phase: 'detailed',
  },
  {
    text: 'Does your organization have targets for sustainability-related metrics?',
    type: 'yes_no',
    ifrsStandard: 'S1',
    requirement: 'S1-4: Metrics and Targets',
    weight: 1.3,
    order: 19,
    phase: 'detailed',
  },
  {
    text: 'How are sustainability metrics verified or assured?',
    type: 'text',
    ifrsStandard: 'S1',
    requirement: 'S1-4: Metrics and Targets',
    weight: 1.1,
    order: 20,
    phase: 'detailed',
  },
];

// IFRS S2 Questions (50+)
const ifrsS2Questions: QuestionData[] = [
  // Governance Category - Phase 1 (Quick): 2 questions
  {
    text: 'Does your organization have governance processes for climate-related risks and opportunities?',
    type: 'yes_no',
    ifrsStandard: 'S2',
    requirement: 'S2-1: Governance',
    weight: 1.5,
    order: 1,
    phase: 'quick',
  },
  {
    text: 'How does the board oversee climate-related risks and opportunities?',
    type: 'text',
    ifrsStandard: 'S2',
    requirement: 'S2-1: Governance',
    weight: 1.4,
    order: 2,
    phase: 'quick',
  },
  // Governance Category - Phase 2 (Detailed): 3 questions
  {
    text: 'Does management have responsibility for assessing and managing climate-related risks?',
    type: 'yes_no',
    ifrsStandard: 'S2',
    requirement: 'S2-1: Governance',
    weight: 1.3,
    order: 3,
    phase: 'detailed',
  },
  {
    text: 'How are climate-related matters integrated into the organization\'s governance structure?',
    type: 'text',
    ifrsStandard: 'S2',
    requirement: 'S2-1: Governance',
    weight: 1.2,
    order: 4,
    phase: 'detailed',
  },
  {
    text: 'What expertise does the board have in climate-related matters?',
    type: 'text',
    ifrsStandard: 'S2',
    requirement: 'S2-1: Governance',
    weight: 1.1,
    order: 5,
    phase: 'detailed',
  },
  // Strategy Category - Phase 1 (Quick): 2 questions
  {
    text: 'Has your organization identified climate-related risks (physical and transition risks)?',
    type: 'yes_no',
    ifrsStandard: 'S2',
    requirement: 'S2-2: Strategy',
    weight: 1.5,
    order: 6,
    phase: 'quick',
  },
  {
    text: 'How do climate-related risks affect your organization\'s business model and strategy?',
    type: 'text',
    ifrsStandard: 'S2',
    requirement: 'S2-2: Strategy',
    weight: 1.5,
    order: 7,
    phase: 'quick',
  },
  // Strategy Category - Phase 2 (Detailed): 6 questions
  {
    text: 'What physical climate risks does your organization face?',
    type: 'text',
    ifrsStandard: 'S2',
    requirement: 'S2-2: Strategy',
    weight: 1.4,
    order: 8,
    phase: 'detailed',
  },
  {
    text: 'What transition climate risks does your organization face?',
    type: 'text',
    ifrsStandard: 'S2',
    requirement: 'S2-2: Strategy',
    weight: 1.4,
    order: 9,
    phase: 'detailed',
  },
  {
    text: 'What climate-related opportunities has your organization identified?',
    type: 'text',
    ifrsStandard: 'S2',
    requirement: 'S2-2: Strategy',
    weight: 1.3,
    order: 10,
    phase: 'detailed',
  },
  {
    text: 'Has your organization conducted scenario analysis for climate-related risks?',
    type: 'yes_no',
    ifrsStandard: 'S2',
    requirement: 'S2-2: Strategy',
    weight: 1.4,
    order: 11,
    phase: 'detailed',
  },
  {
    text: 'What climate scenarios has your organization analyzed?',
    type: 'text',
    ifrsStandard: 'S2',
    requirement: 'S2-2: Strategy',
    weight: 1.2,
    order: 12,
    phase: 'detailed',
  },
  {
    text: 'How resilient is your organization\'s strategy to different climate scenarios?',
    type: 'text',
    ifrsStandard: 'S2',
    requirement: 'S2-2: Strategy',
    weight: 1.3,
    order: 13,
    phase: 'detailed',
  },
  // Risk Category - Phase 1 (Quick): 2 questions
  {
    text: 'Does your organization have a process to identify, assess, and manage climate-related risks?',
    type: 'yes_no',
    ifrsStandard: 'S2',
    requirement: 'S2-3: Risk Management',
    weight: 1.5,
    order: 14,
    phase: 'quick',
  },
  {
    text: 'How are climate-related risks integrated into the overall risk management process?',
    type: 'text',
    ifrsStandard: 'S2',
    requirement: 'S2-3: Risk Management',
    weight: 1.4,
    order: 15,
    phase: 'quick',
  },
  // Risk Category - Phase 2 (Detailed): 3 questions
  {
    text: 'What risk assessment methodologies are used for climate-related risks?',
    type: 'text',
    ifrsStandard: 'S2',
    requirement: 'S2-3: Risk Management',
    weight: 1.3,
    order: 16,
    phase: 'detailed',
  },
  {
    text: 'How frequently are climate-related risks assessed?',
    type: 'multiple_choice',
    options: JSON.stringify(['Continuously', 'Monthly', 'Quarterly', 'Annually', 'Ad-hoc']),
    ifrsStandard: 'S2',
    requirement: 'S2-3: Risk Management',
    weight: 1.2,
    order: 17,
    phase: 'detailed',
  },
  {
    text: 'What controls are in place to manage climate-related risks?',
    type: 'text',
    ifrsStandard: 'S2',
    requirement: 'S2-3: Risk Management',
    weight: 1.3,
    order: 18,
    phase: 'detailed',
  },
  // Metrics Category - Phase 1 (Quick): 2 questions
  {
    text: 'Does your organization measure Scope 1 greenhouse gas (GHG) emissions?',
    type: 'yes_no',
    ifrsStandard: 'S2',
    requirement: 'S2-4: Metrics and Targets',
    weight: 1.5,
    order: 19,
    phase: 'quick',
  },
  {
    text: 'Does your organization have climate-related targets (e.g., net-zero, emission reduction)?',
    type: 'yes_no',
    ifrsStandard: 'S2',
    requirement: 'S2-4: Metrics and Targets',
    weight: 1.5,
    order: 20,
    phase: 'quick',
  },
  // Metrics Category - Phase 2 (Detailed): 6 questions
  {
    text: 'Does your organization measure Scope 2 greenhouse gas (GHG) emissions?',
    type: 'yes_no',
    ifrsStandard: 'S2',
    requirement: 'S2-4: Metrics and Targets',
    weight: 1.5,
    order: 21,
    phase: 'detailed',
  },
  {
    text: 'Does your organization measure Scope 3 greenhouse gas (GHG) emissions?',
    type: 'yes_no',
    ifrsStandard: 'S2',
    requirement: 'S2-4: Metrics and Targets',
    weight: 1.4,
    order: 22,
    phase: 'detailed',
  },
  {
    text: 'What methodology does your organization use to calculate GHG emissions?',
    type: 'text',
    ifrsStandard: 'S2',
    requirement: 'S2-4: Metrics and Targets',
    weight: 1.3,
    order: 23,
    phase: 'detailed',
  },
  {
    text: 'What are your organization\'s climate-related targets?',
    type: 'text',
    ifrsStandard: 'S2',
    requirement: 'S2-4: Metrics and Targets',
    weight: 1.4,
    order: 24,
    phase: 'detailed',
  },
  {
    text: 'How does your organization track progress against climate-related targets?',
    type: 'text',
    ifrsStandard: 'S2',
    requirement: 'S2-4: Metrics and Targets',
    weight: 1.3,
    order: 25,
    phase: 'detailed',
  },
  {
    text: 'What climate-related metrics are disclosed in your financial statements?',
    type: 'text',
    ifrsStandard: 'S2',
    requirement: 'S2-4: Metrics and Targets',
    weight: 1.2,
    order: 26,
    phase: 'detailed',
  },
];

async function seed() {
  console.log('🌱 Seeding question categories...');
  
  // Create categories
  const categories = await Promise.all(
    questionCategories.map(async (cat) => {
      return await prisma.questionCategory.upsert({
        where: { name: cat.name },
        update: {},
        create: cat,
      });
    })
  );

  console.log(`✅ Created ${categories.length} question categories`);

  // Create IFRS S1 questions
  console.log('🌱 Seeding IFRS S1 questions...');
  for (const qData of ifrsS1Questions) {
    const category = categories.find((c) => {
      if (qData.order <= 5) return c.name === 'governance';
      if (qData.order <= 10) return c.name === 'strategy';
      if (qData.order <= 15) return c.name === 'risk';
      return c.name === 'metrics';
    });

    if (category) {
      await prisma.question.create({
        data: {
          ...qData,
          categoryId: category.id,
        },
      });
    }
  }
  console.log(`✅ Created ${ifrsS1Questions.length} IFRS S1 questions`);

  // Create IFRS S2 questions
  console.log('🌱 Seeding IFRS S2 questions...');
  for (const qData of ifrsS2Questions) {
    const category = categories.find((c) => {
      if (qData.order <= 5) return c.name === 'governance';
      if (qData.order <= 13) return c.name === 'strategy';
      if (qData.order <= 18) return c.name === 'risk';
      return c.name === 'metrics';
    });

    if (category) {
      await prisma.question.create({
        data: {
          ...qData,
          categoryId: category.id,
        },
      });
    }
  }
  console.log(`✅ Created ${ifrsS2Questions.length} IFRS S2 questions`);

  console.log('✅ Seeding completed!');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
