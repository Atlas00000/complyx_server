-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "assessmentType" TEXT NOT NULL DEFAULT 'full',
ADD COLUMN     "microTopic" TEXT,
ADD COLUMN     "totalQuestions" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "questionSet" TEXT;
