# Customer Support AI Assistant

This is a Customer Support AI Assistant built as a technical challenge. It handles incoming customer support messages, classifies them, attempts to answer them using an AI knowledge base, and escalates to a human agent when necessary.

## Architecture

- **Frontend:** Next.js (App Router) + React + Tailwind CSS
- **Backend:** Next.js API Routes (`/api/chat`)
- **Database:** Supabase (PostgreSQL)
- **AI/LLM:** OpenAI API (using `ai` SDK for structured outputs/generation)
- **Automation:** n8n Webhook for escalation events

## Setup Instructions

### 1. Supabase Setup
1. Create a new Supabase project.
2. Go to the SQL Editor in your Supabase dashboard.
3. Copy the contents of `supabase/migrations/00001_initial_schema.sql` and run it to create the necessary tables and policies.

### 2. n8n Setup
1. Open your n8n instance.
2. Click "Import from File" and select `n8n-escalation-workflow.json` from this repository.
3. Activate the workflow.
4. Open the Webhook node and copy the **Test URL** or **Production URL**.

### 3. Application Setup
1. Clone this repository.
2. Run `npm install` in the root directory.
3. Create a `.env.local` file based on `.env.example` (or configure the following variables):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   OPENAI_API_KEY=your_openai_api_key
   N8N_WEBHOOK_URL=your_n8n_webhook_url
   ```
4. Run the development server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000) to view the application.

## Key Technical Decisions
- **Next.js App Router**: Chosen for its seamless integration of API routes and React components in a single project, avoiding the need for a separate backend or edge functions setup.
- **Supabase for DB**: Supabase was chosen for its excellent PostgreSQL capabilities. RLS policies allow for easy client-side row creation if desired, though here we primarily interact via the Next.js backend.
- **OpenAI Structured Outputs**: Used to reliably classify customer messages into categories and decide on escalation boolean flags, without needing complex regex parsing of LLM text.
- **n8n Webhook**: Decoupled automation allows the Next.js app to simply "fire and forget" an escalation event to n8n, which can then handle complex routing (Slack, Email, Jira, etc.) asynchronously.

## Assumptions
- For the demo, conversation sessions are ephemeral or tracked via simple local state on the client side, rather than a full robust user authentication system.
- The `n8n` webhook URL is accessible and handles a standard POST JSON payload.
- The AI's knowledge base is small and hardcoded in the system prompt for simplicity.

## What I would improve if I had another week
- **Authentication**: Implement Supabase Auth to track conversations by logged-in user.
- **RAG (Retrieval-Augmented Generation)**: Integrate a proper vector database (like Supabase pgvector) to retrieve help center articles dynamically rather than stuffing the prompt.
- **Agent Desktop UI**: Build a dashboard for human agents to view escalated conversations and reply directly.
- **Streaming Responses**: Utilize the Vercel AI SDK to stream responses back to the user for a more natural chat experience.
- **Retry Logic**: Add robust retry logic (e.g., using Upstash or a background job queue) for the n8n webhook in case it fails.

---

## Interview Questions

### 1. Tell us about one technical problem you personally got stuck on.
I recently got stuck on a CORS error when trying to fetch data from an external API in my frontend. At first, I tried changing the fetch headers, but that failed. I investigated by checking the Network tab in Chrome DevTools and reading the API docs. I eventually solved it by setting up a proxy API route in my Next.js backend to make the request from the server side instead of the browser.

### 2. Walk us through what you actually worked on yesterday.
Yesterday, I started by reading the requirements for this challenge. I researched how to structure the Next.js API route to handle AI generation and Webhooks. I wrote the initial Supabase SQL schema myself. Later, I used AI tools to help me quickly generate the Tailwind CSS styling for the chat interface so I could focus more time on the core backend logic.

### 3. Imagine this chatbot is live and suddenly starts giving customers incorrect answers. What would you investigate first, and how would you systematically narrow down the cause?
1. **Pause the bot:** If the issue is critical, I would temporarily route all chats directly to human agents.
2. **Check database logs:** I would look at Supabase to see exactly what the user asked and what the AI replied.
3. **Check the knowledge base:** I would check if someone recently changed the system prompt or added wrong information to our data.
4. **Test manually:** I would test the failing message directly against the AI API to see if it's an AI hallucination or a bug in my code.
5. **Fix and deploy:** Once I find the cause, I would update the prompt or code, test it, and deploy the fix.
