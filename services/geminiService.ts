
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, CategoryType, TransactionDirection } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractTransactionsFromPDF = async (base64Data: string): Promise<Transaction[]> => {
  // Use the recommended model for multimodal/PDF tasks
  const modelName = 'gemini-3-flash-preview';
  
  const prompt = `
    Analyze this financial statement and extract all transactions. 
    For each transaction, determine:
    - date: YYYY-MM-DD
    - bankName: The name of the bank or institution
    - description: Merchant name or transaction detail
    - amount: The numerical value (always positive)
    - direction: "Spent" for withdrawals/purchases or "Received" for deposits/credits
    - type: "Personal" or "Office" based on description (e.g., AWS, LinkedIn, Staples are Office; Starbucks, Rent, Grocery are Personal)
    
    Return a valid JSON array of objects.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Data
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              bankName: { type: Type.STRING },
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              direction: { type: Type.STRING },
              type: { type: Type.STRING }
            },
            required: ['date', 'bankName', 'description', 'amount', 'direction', 'type']
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No text returned from Gemini API");
    
    const parsed = JSON.parse(text);

    return parsed.map((item: any) => ({
      ...item,
      id: Math.random().toString(36).substr(2, 9),
      type: item.type === 'Office' ? CategoryType.OFFICE : CategoryType.PERSONAL,
      direction: item.direction === 'Received' ? TransactionDirection.RECEIVED : TransactionDirection.SPENT,
      status: 'pending',
      tag: 'Uncategorized'
    }));
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    throw new Error(error.message || "Failed to extract data from PDF");
  }
};
