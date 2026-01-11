import { GoogleGenAI, Type } from "@google/genai";

/**
 * Corrects spelling and minor grammar errors using gemini-flash-lite-latest for low latency.
 */
export const fixSpelling = async (text: string): Promise<string> => {
  if (!text.trim() || text.length < 2) return text;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: `Fix only spelling and minor grammar errors in the following text. 
      DO NOT change the meaning. 
      DO NOT add or remove information. 
      DO NOT change the professional tone.
      Return ONLY the corrected text. 
      Text: "${text}"`,
    });

    return response.text?.trim() || text;
  } catch (error: any) {
    console.error("AI Spelling Correction failed:", error);
    return text;
  }
};

/**
 * Analyzes DevOps comments to extract status updates.
 * Specifically looks for "completed", "next steps", and a general "current status".
 */
export const analyzeDevOpsComments = async (comments: string[]): Promise<{summary: string, completed: string[], next: string[]}> => {
  if (comments.length === 0) return { summary: "No discussion history found.", completed: [], next: [] };
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // We reverse comments to put latest information first for context prioritization
    const latestFirst = [...comments].reverse();

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an expert EDI Project Manager at Aptean. Analyze the following Azure DevOps discussion comments.
      
      Extract the status into exactly three parts:
      1. COMPLETED: Key technical milestones, validated documents (e.g. 850, 860, 810), and successful testing connections. 
      2. NEXT TASK: Specific go-live dates/times, pending files, or upcoming monitoring tasks.
      3. SUMMARY FOR THE FEATURE: A very short (1 sentence) overview of readiness.
      
      Special Attention:
      - Look for go-live dates (e.g., Jan 6, 2026).
      - Look for document validation (850, 860, 810).
      - Look for environment details (ALDIS_US_MS_PRD).
      - If you see "[IMAGE: ...]" markers, treat it as visual confirmation of success.
      
      Format your response strictly as JSON.
      
      Comments:
      ${latestFirst.join('\n---\n')}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "Short 1-sentence readiness summary."
            },
            completed: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Short list of technical milestones finished."
            },
            next: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "The immediate next action with date/time if available."
            }
          },
          required: ["summary", "completed", "next"]
        }
      }
    });

    const text = response.text || '{"summary": "Status unknown", "completed": [], "next": []}';
    const parsed = JSON.parse(text);
    
    // Ensure lists are never empty for UI clarity
    if (parsed.completed.length === 0) parsed.completed = ["Ongoing project activities."];
    if (parsed.next.length === 0) parsed.next = ["Review latest comments for next steps."];
    
    return parsed;
  } catch (error) {
    console.error("DevOps Comment Analysis failed:", error);
    return { summary: "Unable to analyze history", completed: ["Analysis failed."], next: ["Manual check required."] };
  }
};

/**
 * Handles complex reasoning queries using gemini-3-pro-preview with max thinking budget.
 */
export const askComplexQuery = async (prompt: string, context: string, userProfile?: { name: string, email: string }): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const userContext = userProfile ? `User Profile: ${userProfile.name} (${userProfile.email})` : '';
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Context (Current Weekly Plan):
      ${context}
      
      ${userContext}
      
      User Query: ${prompt}
      
      Please provide a detailed, professional, and well-reasoned response based on the planning context. If the query relates to workload, prioritize items assigned to the user or categorized as P1.`,
      config: {
        thinkingConfig: { thinkingBudget: 32768 }
      }
    });

    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error: any) {
    console.error("Thinking Mode failed:", error);
    
    if (error?.message?.includes("Requested entity was not found")) {
      throw new Error("API_KEY_EXPIRED");
    }
    
    return "Error connecting to AI Assistant. Please ensure your API key is correctly configured.";
  }
};
