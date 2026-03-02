/**
 * Seed IFRS S1/S2 in-chat assessment question bank (framework.md).
 * Quick: G1, G2, S1, R1, M1. Full: all 20. Micro: 5 per pillar.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { name: 'governance', description: 'Oversight, roles, processes' },
  { name: 'strategy', description: 'Approach, integration, targets' },
  { name: 'risk', description: 'Identification, assessment, management' },
  { name: 'metrics', description: 'KPIs, measurement, disclosure' },
];

interface QuestionSeed {
  key: string;
  categoryName: string;
  text: string;
  type: string;
  options: string | null;
  order: number;
  questionSet: string; // JSON array: ["full","quick","micro_governance"] etc.
}

const questions: QuestionSeed[] = [
  // Governance
  {
    key: 'G1',
    categoryName: 'governance',
    text: 'How does your board oversee sustainability and climate-related matters?',
    type: 'multiple_choice',
    options: JSON.stringify([
      { value: 'A', label: 'Dedicated sustainability committee with regular reporting', score: 100 },
      { value: 'B', label: 'Part of existing committee (e.g. audit/risk) with defined responsibilities', score: 75 },
      { value: 'C', label: 'Ad hoc board discussions', score: 50 },
      { value: 'D', label: 'No formal board oversight', score: 0 },
    ]),
    order: 1,
    questionSet: '["full","quick","micro_governance"]',
  },
  {
    key: 'G2',
    categoryName: 'governance',
    text: 'Does your organization have a designated executive or team responsible for sustainability and climate disclosures?',
    type: 'yes_no',
    options: null,
    order: 2,
    questionSet: '["full","quick","micro_governance"]',
  },
  {
    key: 'G3',
    categoryName: 'governance',
    text: 'How formalized is your governance structure for sustainability reporting? (1 = Ad hoc, 5 = Integrated into board and management processes)',
    type: 'scale',
    options: null,
    order: 3,
    questionSet: '["full","micro_governance"]',
  },
  {
    key: 'G4',
    categoryName: 'governance',
    text: 'How does your organization ensure competence in sustainability and climate reporting?',
    type: 'multiple_choice',
    options: JSON.stringify([
      { value: 'A', label: 'Formal training programs for relevant staff', score: 100 },
      { value: 'B', label: 'Access to external expertise when needed', score: 75 },
      { value: 'C', label: 'Informal knowledge sharing', score: 50 },
      { value: 'D', label: 'No specific measures', score: 0 },
    ]),
    order: 4,
    questionSet: '["full","micro_governance"]',
  },
  {
    key: 'G5',
    categoryName: 'governance',
    text: 'Do you have internal controls or processes to ensure the accuracy of sustainability disclosures?',
    type: 'yes_no',
    options: null,
    order: 5,
    questionSet: '["full","micro_governance"]',
  },
  // Strategy
  {
    key: 'S1',
    categoryName: 'strategy',
    text: 'How are sustainability and climate considerations integrated into your strategy?',
    type: 'multiple_choice',
    options: JSON.stringify([
      { value: 'A', label: 'Core to strategy and decision-making', score: 100 },
      { value: 'B', label: 'Considered in major strategic decisions', score: 75 },
      { value: 'C', label: 'Addressed in specific initiatives', score: 50 },
      { value: 'D', label: 'Not formally integrated', score: 0 },
    ]),
    order: 6,
    questionSet: '["full","quick","micro_strategy"]',
  },
  {
    key: 'S2',
    categoryName: 'strategy',
    text: 'Does your strategy explicitly consider short-, medium-, and long-term time horizons for sustainability and climate?',
    type: 'yes_no',
    options: null,
    order: 7,
    questionSet: '["full","micro_strategy"]',
  },
  {
    key: 'S3',
    categoryName: 'strategy',
    text: 'Have you conducted climate-related scenario analysis (e.g. 1.5°C, 2°C, or entity-specific scenarios)?',
    type: 'multiple_choice',
    options: JSON.stringify([
      { value: 'A', label: 'Yes, multiple scenarios, used in strategy', score: 100 },
      { value: 'B', label: 'Yes, at least one scenario', score: 75 },
      { value: 'C', label: 'In progress', score: 50 },
      { value: 'D', label: 'Not started', score: 0 },
    ]),
    order: 8,
    questionSet: '["full","quick","micro_strategy"]',
  },
  {
    key: 'S4',
    categoryName: 'strategy',
    text: 'To what extent does your strategy consider sustainability and climate across the value chain? (1 = Not considered, 5 = Fully integrated)',
    type: 'scale',
    options: null,
    order: 9,
    questionSet: '["full","micro_strategy"]',
  },
  {
    key: 'S5',
    categoryName: 'strategy',
    text: 'Do you have a climate transition plan (or equivalent) that outlines how you will adapt to a low-carbon economy?',
    type: 'yes_no',
    options: null,
    order: 10,
    questionSet: '["full","micro_strategy"]',
  },
  // Risk
  {
    key: 'R1',
    categoryName: 'risk',
    text: 'How does your organization identify sustainability and climate-related risks?',
    type: 'multiple_choice',
    options: JSON.stringify([
      { value: 'A', label: 'Formal, periodic process integrated with enterprise risk management', score: 100 },
      { value: 'B', label: 'Dedicated process for sustainability/climate risks', score: 75 },
      { value: 'C', label: 'Ad hoc identification', score: 50 },
      { value: 'D', label: 'No formal process', score: 0 },
    ]),
    order: 11,
    questionSet: '["full","quick","micro_risk"]',
  },
  {
    key: 'R2',
    categoryName: 'risk',
    text: 'Do you assess sustainability and climate risks for likelihood and impact (or equivalent)?',
    type: 'yes_no',
    options: null,
    order: 12,
    questionSet: '["full","micro_risk"]',
  },
  {
    key: 'R3',
    categoryName: 'risk',
    text: 'How integrated are sustainability and climate risks with your overall risk management framework? (1 = Not integrated, 5 = Fully integrated)',
    type: 'scale',
    options: null,
    order: 13,
    questionSet: '["full","micro_risk"]',
  },
  {
    key: 'R4',
    categoryName: 'risk',
    text: 'How does your organization respond to identified sustainability and climate risks?',
    type: 'multiple_choice',
    options: JSON.stringify([
      { value: 'A', label: 'Documented response plans with ownership and monitoring', score: 100 },
      { value: 'B', label: 'Response plans for material risks', score: 75 },
      { value: 'C', label: 'Informal responses', score: 50 },
      { value: 'D', label: 'No structured response', score: 0 },
    ]),
    order: 14,
    questionSet: '["full","micro_risk"]',
  },
  {
    key: 'R5',
    categoryName: 'risk',
    text: 'Do you identify and assess sustainability and climate-related opportunities (not only risks)?',
    type: 'yes_no',
    options: null,
    order: 15,
    questionSet: '["full","micro_risk"]',
  },
  // Metrics
  {
    key: 'M1',
    categoryName: 'metrics',
    text: 'What is the status of your Scope 1 and 2 greenhouse gas emissions measurement?',
    type: 'multiple_choice',
    options: JSON.stringify([
      { value: 'A', label: 'Measured and assured (or in process)', score: 100 },
      { value: 'B', label: 'Measured, not yet assured', score: 75 },
      { value: 'C', label: 'In progress', score: 50 },
      { value: 'D', label: 'Not started', score: 0 },
    ]),
    order: 16,
    questionSet: '["full","quick","micro_metrics"]',
  },
  {
    key: 'M2',
    categoryName: 'metrics',
    text: 'What is the status of your Scope 3 emissions assessment?',
    type: 'multiple_choice',
    options: JSON.stringify([
      { value: 'A', label: 'Measured for relevant categories', score: 100 },
      { value: 'B', label: 'Partial Scope 3 coverage', score: 75 },
      { value: 'C', label: 'In progress', score: 50 },
      { value: 'D', label: 'Not started', score: 0 },
    ]),
    order: 17,
    questionSet: '["full","micro_metrics"]',
  },
  {
    key: 'M3',
    categoryName: 'metrics',
    text: 'Do you have quantitative climate-related targets (e.g. emissions reductions, net zero)?',
    type: 'yes_no',
    options: null,
    order: 18,
    questionSet: '["full","quick","micro_metrics"]',
  },
  {
    key: 'M4',
    categoryName: 'metrics',
    text: 'How mature is your approach to sustainability and climate metrics and KPIs? (1 = No metrics, 5 = Aligned with IFRS S2 and used in decision-making)',
    type: 'scale',
    options: null,
    order: 19,
    questionSet: '["full","micro_metrics"]',
  },
  {
    key: 'M5',
    categoryName: 'metrics',
    text: 'How would you describe the quality and reliability of your sustainability and climate data?',
    type: 'multiple_choice',
    options: JSON.stringify([
      { value: 'A', label: 'High quality, validated, with clear methodology', score: 100 },
      { value: 'B', label: 'Good quality, some validation', score: 75 },
      { value: 'C', label: 'Basic quality, limited validation', score: 50 },
      { value: 'D', label: 'Poor quality or not yet established', score: 0 },
    ]),
    order: 20,
    questionSet: '["full","micro_metrics"]',
  },
];

async function main() {
  console.log('🌱 Seeding assessment question bank...');

  const categoryIds = new Map<string, string>();
  for (const c of categories) {
    const cat = await prisma.questionCategory.upsert({
      where: { name: c.name },
      create: { name: c.name, description: c.description },
      update: { description: c.description },
    });
    categoryIds.set(c.name, cat.id);
  }
  console.log('✅ Categories ready');

  let created = 0;
  let updated = 0;
  for (const q of questions) {
    const categoryId = categoryIds.get(q.categoryName);
    if (!categoryId) throw new Error(`Unknown category: ${q.categoryName}`);

    const existing = await prisma.question.findFirst({
      where: { text: q.text, categoryId },
    });

    const data = {
      categoryId,
      text: q.text,
      type: q.type,
      options: q.options,
      ifrsStandard: 'S1',
      weight: 1.0,
      order: q.order,
      questionSet: q.questionSet,
      isActive: true,
    };

    if (existing) {
      await prisma.question.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.question.create({ data });
      created++;
    }
  }

  console.log(`✅ Questions: ${created} created, ${updated} updated`);
  console.log('🎉 Assessment question seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
