import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, CategoryType, TransactionDirection } from "../types";

export const extractTransactionsFromPDF = async (base64Data: string): Promise<Transaction[]> => {
  // Initialize AI client using the provided environment variable
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  // Use gemini-3-flash-preview for fast and accurate extraction
  const modelName = 'gemini-3-flash-preview';
  
  const prompt = `
    Analyze this bank statement PDF and extract all transactions. 
    For each transaction, determine:
    - date: YYYY-MM-DD
    - bankName: The name of the bank
    - description: Merchant name or details
    - amount: Positive number
    - direction: "Spent" or "Received"
    - type: Categorize as "Office" (business/work related) or "Personal" (individual/lifestyle)
    
    Output a JSON array of objects.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Data
            }
          },
          { text: prompt }
        ]
      }],
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
    if (!text) throw new Error("No response from AI model.");
    
    const parsed = JSON.parse(text);

    return parsed.map((item: any) => ({
      ...item,
      id: `tx-${Math.random().toString(36).substring(2, 11)}`,
      type: item.type === 'Office' ? CategoryType.OFFICE : CategoryType.PERSONAL,
      direction: item.direction === 'Received' ? TransactionDirection.RECEIVED : TransactionDirection.SPENT,
      status: 'pending',
      tag: 'Uncategorized'
    }));
  } catch (error: any) {
    console.error("Extraction Error:", error);
    throw new Error(error.message || "Could not extract data. Check your API key and file format.");
  }
};