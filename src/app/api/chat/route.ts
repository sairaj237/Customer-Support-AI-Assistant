import { createOpenAI } from '@ai-sdk/openai';

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});
import { generateObject, generateText, streamText } from 'ai';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { triggerEscalationWebhook } from '@/lib/n8n';

// Simple knowledge base for the demo
const KNOWLEDGE_BASE = `
You are a helpful customer support AI for a SaaS product called "TechFlow".
Here is some information you know:
- TechFlow is a project management tool.
- Pricing: Basic is $10/mo, Pro is $25/mo, Enterprise is custom.
- Password resets: Users can reset passwords at techflow.com/reset. If they don't receive an email, they should check spam, or we might need to manually verify their account.
- Operating hours: Support is available 24/7 via AI, human agents available 9 AM - 5 PM EST Monday-Friday.
- API limits: 1000 requests per minute on Pro.

If you don't know the answer, or if the user is frustrated, or if it requires manual human intervention (like checking an account or resolving a bug), you MUST be escalated.
`;

export async function POST(req: Request) {
  try {
    const { messages, conversationId } = await req.json();
    const latestMessage = messages[messages.length - 1].content;
    
    let currentConversationId = conversationId;
    
    // 1. Create conversation if none exists
    if (!currentConversationId) {
        const { data: conv, error: convError } = await supabase
            .from('conversations')
            .insert([{ status: 'open' }])
            .select()
            .single();
            
        if (convError) throw convError;
        currentConversationId = conv.id;
    }

    // 2. Save user message
    await supabase.from('messages').insert([{
        conversation_id: currentConversationId,
        role: 'user',
        content: latestMessage
    }]);

    // 3. Classify and evaluate escalation
    const { object: classification } = await generateObject({
      model: openrouter('openai/gpt-oss-20b:free'),
      schema: z.object({
        category: z.enum(['general_question', 'technical_issue', 'billing', 'urgent']),
        needsEscalation: z.boolean().describe("Set to true if the AI cannot solve the issue, if the user is frustrated, or if it requires manual human intervention (e.g. account verification, bug)."),
        reason: z.string().describe("The reason for escalation, if applicable. Keep it brief. Empty string if not escalated.")
      }),
      prompt: `Classify the following customer message. \n\nMessage: "${latestMessage}"`,
    });

    // 4. Handle Escalation
    if (classification.needsEscalation || classification.category === 'urgent') {
        // Mark as escalated
        await supabase
            .from('conversations')
            .update({ status: 'escalated' })
            .eq('id', currentConversationId);
            
        await supabase.from('escalations').insert([{
            conversation_id: currentConversationId,
            reason: classification.reason || 'Urgent/Unresolvable by AI',
            classified_category: classification.category
        }]);

        // Trigger Webhook
        await triggerEscalationWebhook({
            conversation_id: currentConversationId,
            customer_message: latestMessage,
            classified_category: classification.category,
            reason: classification.reason || 'Needs human handoff'
        });

        const escalationMessage = "I understand this is a complex issue. I have escalated this conversation to our human support team. They will review your request and get back to you shortly.";
        
        await supabase.from('messages').insert([{
            conversation_id: currentConversationId,
            role: 'assistant',
            content: escalationMessage
        }]);

        return Response.json({
            message: escalationMessage,
            conversationId: currentConversationId,
            escalated: true
        });
    }

    // 5. Generate AI Response if no escalation
    const { text: aiResponse } = await generateText({
      model: openrouter('openai/gpt-oss-20b:free'),
      system: KNOWLEDGE_BASE,
      messages: messages,
    });

    // Save assistant response
    await supabase.from('messages').insert([{
        conversation_id: currentConversationId,
        role: 'assistant',
        content: aiResponse
    }]);

    return Response.json({
        message: aiResponse,
        conversationId: currentConversationId,
        escalated: false
    });

  } catch (error) {
    console.error("Chat API Error:", error);
    return Response.json({ error: 'An error occurred' }, { status: 500 });
  }
}
