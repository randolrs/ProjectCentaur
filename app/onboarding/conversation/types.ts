// Result of a background adaptive-question generation. Defined outside
// actions.ts because a 'use server' module may only export async functions.

export type GenerateQuestionResult =
  | { status: 'question'; question: string }
  | { status: 'failed' };
