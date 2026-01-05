import { GoogleGenAI } from "@google/genai";

/**
 * Corrects spelling and minor grammar errors using gemini-flash-lite-latest for low latency.
 */
export const fixSpelling = async (text: string): Promise<string> => {
  if (!text.trim() || text.length < 2) return text;

  try {
    // Initialize inside the call to get the latest API_KEY from process.env
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
 * Handles complex reasoning queries using gemini-3-pro-preview with max thinking budget.
 */
export const askComplexQuery = async (prompt: string, context: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Context (Current Weekly Plan):
      ${context}
      
      User Query: ${prompt}
      
      Please provide a detailed, professional, and well-reasoned response based on the planning context.`,
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
