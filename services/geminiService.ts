import { GoogleGenAI, Type } from "@google/genai";

export class GeminiService {
  private getClient() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  /**
   * Generates high-quality images using Gemini 3 Pro Image.
   */
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
    
    const textPart = response.candidates?.[0]?.content?.parts.find(p => p.text);
    if (textPart?.text) {
        throw new Error(`AI Note: ${textPart.text}`);
    }

    throw new Error("No image data generated.");
  }

  /**
   * Researches trends and then generates a highly optimized background image.
   */
  async generateSmartBackground(prompt: string) {
    const ai = this.getClient();
    
    // 1. Research trends using Google Search grounding
    const research = await this.researchTopic(`visual aesthetic trends and reference details for: ${prompt}`);
    
    // 2. Refine prompt based on search results
    const refinement = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Based on this research: "${research.text}", write a highly detailed professional artistic image prompt for a background representing: "${prompt}". Return ONLY the new prompt in English.`,
    });
    
    const finalPrompt = refinement.text || prompt;

    // 3. Generate high quality image
    return this.generateImage(finalPrompt, "16:9");
  }

  /**
   * Uses Google Search grounding to research design topics.
   */
  async researchTopic(topic: string) {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Investiga tendencias visuales, paletas de colores y datos actuales para un diseño sobre: "${topic}". Proporciona consejos prácticos para un diseñador en español.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const sources: { title?: string, uri: string }[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({ title: chunk.web.title, uri: chunk.web.uri });
        }
      });
    }

    return {
      text: response.text || "No se encontró información.",
      sources
    };
  }

  async remixImage(base64Image: string, style: string) {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: `Remix this image style to: ${style}` }
        ]
      }
    });

    const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (imagePart?.inlineData?.data) {
      return `data:image/png;base64,${imagePart.inlineData.data}`;
    }
    throw new Error("Failed to remix.");
  }

  async analyzeDesign(base64Image: string) {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Analiza la composición de esta imagen y da 3 consejos de mejora en español." }
        ]
      }
    });
    return response.text;
  }
}