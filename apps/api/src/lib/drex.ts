/**
 * Drex by Nace.AI — decision model client.
 *
 * Drex returns calibrated probabilities for every option in one forward pass.
 * It never writes text; it only returns probabilities over the options given.
 *
 * Wire-compatible with TypeSafe's Jev via @typesafe-ai/sdk:
 *   TYPESAFE_BASE_URL=https://drex.nace.ai
 *   TYPESAFE_API_KEY=<your Drex API key>
 *   TYPESAFE_DEFAULT_MODEL=drex-latest
 *
 * Reference: https://nace.ai/drex.md
 */
import { TypeSafeClient, noul, choice, score } from '@typesafe-ai/sdk';

export { noul, choice, score };

/**
 * Shared Drex client. Reads TYPESAFE_BASE_URL, TYPESAFE_API_KEY, and
 * TYPESAFE_DEFAULT_MODEL from the environment (see .env.example).
 */
export const drex = new TypeSafeClient();

/**
 * Ask Drex one or more typed questions about a state.
 * Several questions about one state share a single forward pass.
 *
 * @example
 * ```ts
 * const { answers } = await drex.systemOne({
 *   state: "Help! My payouts have been failing for 3 days.",
 *   questions: {
 *     is_urgent: noul("Does this convey urgency?"),
 *     category: choice("What is this about?", {
 *       billing: "Payment or billing issue",
 *       technical: "Technical or integration issue",
 *       account: "Account or access issue",
 *     }),
 *     severity: score("How severe is this?", ["low", "medium", "high"]),
 *   },
 * });
 * ```
 */
export async function decide<Q extends import('@typesafe-ai/sdk').Questions>(
  state: string,
  questions: Q,
) {
  const result = await drex.systemOne({ state, questions });
  return result.answers;
}
