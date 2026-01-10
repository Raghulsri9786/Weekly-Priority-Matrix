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
 */
export const analyzeDevOpsComments = async (comments: string[]): Promise<{completed: string[], next: string[]}> => {
  if (comments.length === 0) return { completed: [], next: [] };
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following Azure DevOps discussion comments for a single work item. 
      Extract structured progress information:
      1. Completed Tasks: Items explicitly mentioned as done, finished, or tested successfully.
      2. Next Tasks: Upcoming actions, plans, or next steps mentioned.
      
      Format your response strictly as JSON with "completed" and "next" arrays of strings.
      
      Comments:
      ${comments.join('\n---\n')}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            completed: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Tasks that are finished."
            },
            next: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Upcoming or planned tasks."
            }
          },
          required: ["completed", "next"]
        }
      }
    });

    const text = response.text || '{"completed": [], "next": []}';
    return JSON.parse(text);
  } catch (error) {
    console.error("DevOps Comment Analysis failed:", error);
    return { completed: [], next: [] };
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