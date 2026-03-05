-- CreateIndex
CREATE INDEX "answers_assessmentId_idx" ON "answers"("assessmentId");

-- CreateIndex
CREATE INDEX "answers_questionId_idx" ON "answers"("questionId");

-- CreateIndex
CREATE INDEX "assessments_userId_idx" ON "assessments"("userId");

-- CreateIndex
CREATE INDEX "assessments_createdAt_idx" ON "assessments"("createdAt");

-- CreateIndex
CREATE INDEX "assessments_status_idx" ON "assessments"("status");

-- CreateIndex
CREATE INDEX "questions_categoryId_idx" ON "questions"("categoryId");
