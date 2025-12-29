
import { GoogleGenAI, Type, Modality } from "@google/genai";

export class GeminiService {
  private getClient() {
    // Always create a new instance to ensure we use the most up-to-date API key from the environment
    return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async generateImage(prompt: string, aspectRatio: string = "1:1") {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
          imageSize: "1K"
        }
      }
    });

    const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (imagePart?.inlineData?.data) {
      return `data:image/png;base64,${imagePart.inlineData.data}`;
    }
    
    // Sometimes text response is also returned
    const textPart = response.candidates?.[0]?.content?.parts.find(p => p.text);
    if (textPart?.text && !imagePart) {
        throw new Error(`Model returned text instead of image: ${textPart.text}`);
    }

    throw new Error("No image data found in the model response.");
  }

  async remixImage(base64Image: string, style: string) {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { 
            inlineData: { 
              mimeType: 'image/jpeg', 
              data: base64Image 
            } 
          },
          { text: `Remix this image using the following style instructions: ${style}. Maintain the core composition but transform the artistic direction.` }
        ]
      }
    });

    const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (imagePart?.inlineData?.data) {
      return `data:image/png;base64,${imagePart.inlineData.data}`;
    }
    throw new Error("Failed to remix image. The model did not return image data.");
  }

  async generateTextIdeas(topic: string, type: string) {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a professional copywriter. Generate 5 unique and catchy ${type} ideas for: "${topic}".`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  }

  async generatePalette(theme: string) {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Design a professional color palette (5 hex codes) for the theme: "${theme}". Provide only the codes.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING, description: "Hex color code (e.g., #FFFFFF)" }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  }

  async analyzeDesign(base64Image: string) {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Act as a senior UI/UX designer and creative director. Analyze this composition. Critique the balance, color harmony, and typography. Provide 3 actionable and professional tips for improvement." }
        ]
      }
    });
    return response.text;
  }
}
