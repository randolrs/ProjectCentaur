// Result of one conversation turn. Defined outside actions.ts because a
// 'use server' module may only export async functions.

export type SubmitTurnResult =
  | { status: 'question'; question: string; questionNumber: number }
  | { status: 'expired' }
  | { status: 'error'; message: string };
