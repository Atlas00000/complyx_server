/**
 * Chat system prompt additions for assessment-aware behavior.
 * Used when the user has assessment context (e.g. completed assessment) so the AI
 * can use their info without turning every message into an assessment question.
 */

/**
 * When assessment context is injected, add this so the model knows how to use
 * assessment-relevant information the user shares in normal chat.
 */
export const CONTEXTUAL_ASSESSMENT_PROMPT_ADDITION = `
When the user shares information about governance, strategy, risk, or metrics (e.g. board oversight, climate strategy, targets, emissions), you may treat it as relevant to their IFRS S1/S2 readiness. Acknowledge it and use it to personalize guidance when helpful. Do not turn every message into an assessment question—answer normally and only reference their assessment when it adds value. If they ask a direct question, answer it; if they volunteer readiness-related details, briefly acknowledge and tie to their context when appropriate.`;
