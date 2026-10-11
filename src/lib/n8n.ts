export interface EscalationPayload {
  conversation_id: string;
  customer_message: string;
  classified_category: string;
  reason: string;
  urgency_score: number;
  sentiment_score: number;
  escalation_probability: number;
  department: string;
}

export async function triggerEscalationWebhook(data: EscalationPayload) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("No N8N_WEBHOOK_URL configured. Escalation data:", data);
    return;
  }
  
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
        console.error("Failed to trigger n8n webhook, status:", response.status);
    }
  } catch (error) {
    console.error("Failed to trigger n8n webhook", error);
  }
}
