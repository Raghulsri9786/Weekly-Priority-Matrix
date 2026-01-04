
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Corrects spelling and minor grammar errors.
 * Strictly maintains original meaning and length.
 */
export const fixSpelling = async (text: string): Promise<string> => {
  if (!text.trim() || text.length < 2) return text;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Fix only spelling and minor grammar errors in the following text. 
      DO NOT change the meaning. 
      DO NOT add or remove information. 
      DO NOT change the professional tone.
      Return ONLY the corrected text. 
      Text: "${text}"`,
    });

    return response.text?.trim() || text;
  } catch (error) {
    console.error("AI Spelling Correction failed:", error);
    return text;
  }
};
