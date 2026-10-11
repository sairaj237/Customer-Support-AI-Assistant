/**
 * classifier.ts
 *
 * Classifier module for the Jev ticket triage feature.
 * Integrates with TypeSafe AI's Jev model via the OpenRouter Decisions API
 * to produce typed, probabilistic triage results for support tickets.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Department = 'billing' | 'technical' | 'general' | 'urgent';

export interface TriageResult {
  /** The department with the highest probability (or 'general' when confidence < 0.5) */
  department: Department;
  /** Probability for each department as returned by the Jev API */
  departmentProbabilities: Record<Department, number>;
  /** Confidence value returned by the Jev API choice answer (0–1) */
  departmentConfidence: number;
  /** Urgency score on the 1–5 rubric (Jev index-space score + 1) */
  urgencyScore: number;
  /** Full probability distribution across the 5 urgency levels (keys "0"–"4") */
  urgencyProbabilities: Record<string, number>;
  /** Sentiment score on the 0–2 rubric (0=Calm, 1=Frustrated, 2=Very angry) */
  sentimentScore: number;
  /** Full probability distribution across the 3 sentiment levels (keys "0"–"2") */
  sentimentProbabilities: Record<string, number>;
  /** Escalation probability from the Jev API noul answer (0–1) */
  escalationProbability: number;
  /** True when the fallback classification was used instead of a live API response */
  usedFallback: boolean;
}

// ---------------------------------------------------------------------------
// Internal types for the Jev API response
// ---------------------------------------------------------------------------

interface JevChoiceAnswer {
  type: 'choice';
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

interface JevScoreAnswer {
  type: 'score';
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
}

interface JevNoulAnswer {
  type: 'noul';
  noul: number;
}

interface JevApiResponse {
  model: string;
  answers: {
    department: JevChoiceAnswer;
    urgency: JevScoreAnswer;
    sentiment: JevScoreAnswer;
    needs_escalation: JevNoulAnswer;
  };
}

// ---------------------------------------------------------------------------
// Fallback Classification
// ---------------------------------------------------------------------------

/**
 * A deterministic fallback returned whenever the Jev API is unavailable.
 *
 * Values chosen so that none of the three escalation conditions trip:
 *   - escalationProbability 0.5 < 0.7 threshold
 *   - urgencyScore 3 < 4 threshold
 *   - sentimentScore 1 < 1.5 threshold
 *
 * Zero-value probability maps ensure the shape is always consistent with TriageResult.
 */
export const FallbackClassification: TriageResult = {
  department: 'general',
  departmentProbabilities: { billing: 0, technical: 0, general: 0, urgent: 0 },
  departmentConfidence: 0,
  urgencyScore: 3,
  urgencyProbabilities: { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 },
  sentimentScore: 1,
  sentimentProbabilities: { '0': 0, '1': 0, '2': 0 },
  escalationProbability: 0.5,
  usedFallback: true,
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Classifies a support ticket message by calling the Jev API and returning
 * a typed TriageResult. Falls back to a safe default if the API is unavailable.
 *
 * @param message - The customer's support message text
 * @returns A TriageResult containing department, urgency, sentiment, and escalation signals
 */
export async function classifyTicket(message: string): Promise<TriageResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  const requestBody = {
    model: '~typesafe/jev-latest',
    state: message,
    questions: {
      department: {
        type: 'choice',
        instructions: 'Which support team should handle this ticket?',
        criteria: {
          billing: 'Payments, invoicing, subscriptions, refunds, pricing questions',
          technical: 'Bugs, outages, API errors, integrations, performance issues',
          general: 'General questions, how-to, feature requests, account settings',
          urgent: 'Service down, data loss, security incident, account locked out',
        },
      },
      urgency: {
        type: 'score',
        instructions: 'How urgently does this ticket require attention?',
        criteria: [
          '1-Low: no immediate impact',
          '2-Minor: minor inconvenience',
          '3-Moderate: workflow affected',
          '4-High: significant business impact',
          '5-Critical: system down or data at risk',
        ],
      },
      sentiment: {
        type: 'score',
        instructions: "What is the customer's emotional state in this message?",
        criteria: [
          '0-Calm: neutral or polite tone',
          '1-Frustrated: clearly annoyed or impatient',
          '2-Very angry: hostile, threatening, or deeply distressed',
        ],
      },
      needs_escalation: {
        type: 'noul',
        instructions: 'Does this ticket require handoff to a human agent?',
        criteria: {
          true: 'Issue requires account access, manual intervention, or cannot be resolved by AI',
          false: 'Issue can be resolved with information or automated action',
        },
      },
    },
  };

  try {
    const response = await fetch('https://openrouter.ai/api/alpha/decisions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        `[classifier] Jev API returned non-2xx status ${response.status} ${response.statusText}; using fallback classification.`,
      );
      return FallbackClassification;
    }

    let data: JevApiResponse;
    try {
      data = await response.json();
    } catch (parseError) {
      console.warn(
        `[classifier] Failed to parse Jev API response as JSON: ${String(parseError)}; using fallback classification.`,
      );
      return FallbackClassification;
    }

    const { answers } = data;

    // Guard against missing nested fields
    if (!answers?.department || !answers?.urgency || !answers?.sentiment || !answers?.needs_escalation) {
      console.warn(
        '[classifier] Jev API response is missing expected fields; using fallback classification.',
      );
      return FallbackClassification;
    }

    // Map department — apply confidence guard
    const rawDepartment = answers.department.choice as Department;
    const departmentConfidence = answers.department.confidence;
    const department: Department = departmentConfidence < 0.5 ? 'general' : rawDepartment;

    // Map urgency: Jev index-space (0–4) → 1–5 rubric
    const urgencyScore = answers.urgency.score + 1;

    // Map sentiment: already 0–2
    const sentimentScore = answers.sentiment.score;

    // Map escalation probability from noul answer
    const escalationProbability = answers.needs_escalation.noul;

    return {
      department,
      departmentProbabilities: answers.department.probabilities as Record<Department, number>,
      departmentConfidence,
      urgencyScore,
      urgencyProbabilities: answers.urgency.probabilities,
      sentimentScore,
      sentimentProbabilities: answers.sentiment.probabilities,
      escalationProbability,
      usedFallback: false,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[classifier] Jev API call failed: ${reason}; using fallback classification.`);
    return FallbackClassification;
  }
}

/**
 * Determines whether a ticket should be escalated to a human agent.
 *
 * Returns true if ANY of the following conditions hold:
 *   - escalationProbability >= 0.7
 *   - urgencyScore >= 4
 *   - sentimentScore >= 1.5
 *
 * @param result - The TriageResult produced by classifyTicket
 * @returns true if the ticket should be escalated, false otherwise
 */
export function shouldEscalate(result: TriageResult): boolean {
  return result.escalationProbability >= 0.7 || result.urgencyScore >= 4 || result.sentimentScore >= 1.5;
}
