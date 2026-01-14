import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, CategoryType, TransactionDirection } from "../types";

export const extractTransactionsFromPDF = async (base64Data: string): Promise<Transaction[]> => {
  // Always initialize with the environment variable directly
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Use the recommended model for text/extraction tasks
  const modelName = 'gemini-3-flash-preview';
  
  const prompt = `
    Analyze this financial bank statement PDF and extract all individual transactions. 
    For each transaction, precisely identify:
    - date: The transaction date in YYYY-MM-DD format.
    - bankName: The name of the bank or financial institution.
    - description: The merchant name or transaction detail.
    - amount: The numerical value (always return as a positive number).
    - direction: "Spent" for debits/withdrawals/purchases or "Received" for credits/deposits.
    - type: Classify as "Office" if it relates to business (e.g., cloud services, business subscriptions, office rent) or "Personal" for individual/lifestyle spending.
    
    Ensure the output is a clean JSON array.
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
    if (!text) throw new Error("The AI model returned an empty response.");
    
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
    console.error("Gemini Extraction Error:", error);
    throw new Error(error.message || "Failed to analyze PDF. Please ensure your API Key is set in the environment settings.");
  }
};