export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  try {
    const body = await req.json();
    const { prompt, model = "gemini-2.5-flash-image", aspectRatio = "1:1", images = [], resolution = "1K", seed } = body;
    
    let apiKey = process.env.ROUTERHUB_API_KEY;
    let baseUrl = "https://api.routerhub.ai/v1beta";
    
    if (!apiKey && process.env.GEMINI_API_KEY) {
       apiKey = process.env.GEMINI_API_KEY;
       baseUrl = "https://generativelanguage.googleapis.com/v1beta";
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: { message: "API Key is missing. If you just added the key in AI Studio, please click 'Deploy to Cloud Run' again to apply the new secret." } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Typical Google AI format for generateContent
    const parts = [];
    if (images && images.length > 0) {
      for (const img of images) {
        parts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.data
          }
        });
      }
    }
    parts.push({ text: prompt });

    const generationConfig: any = {
      outputFormat: "image/jpeg",
    };

    generationConfig.imageConfig = {
      aspectRatio: aspectRatio
    };
    
    if (seed !== undefined) {
       generationConfig.seed = seed;
    }
    if (['512px', '1K', '2K', '4K'].includes(resolution)) {
       generationConfig.imageConfig.imageSize = resolution;
    }

    const payload = {
      contents: [
        {
          role: "user",
          parts: parts
        }
      ],
      generationConfig: generationConfig
    };

    const headers: any = { 
      "Content-Type": "application/json",
    };
    
    if (baseUrl.includes("routerhub")) {
       headers["Authorization"] = `Bearer ${apiKey}`;
    } else {
       headers["x-goog-api-key"] = apiKey;
    }

    let targetUrl = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`; 
    let requestBody = JSON.stringify(payload);
    let isStandardRouterhub = false;

    // Use Routerhub standard format for non-gemini models if Routerhub key exists
    if (baseUrl.includes("routerhub") && (model.includes("midjourney") || model.includes("flux") || !model.startsWith("gemini"))) {
      isStandardRouterhub = true;
      targetUrl = `https://api.routerhub.ai/v1/images/generations`;
      const oaiPayload = {
        model: model.replace('routerhub/', ''),
        prompt: prompt,
        n: 1,
        // Optional mapping for image sizes depending on resolution/aspectRatio
        size: "1024x1024" 
      };
      requestBody = JSON.stringify(oaiPayload);
    }

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: requestBody
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || response.statusText);
    }
    
    // Convert standard RouterHub OpenAI format response to Gemini format so frontend doesn't break
    let returnedData = data;
    if (isStandardRouterhub && data.data && data.data.length > 0) {
       let imageOutputUrl = data.data[0].url;
       let imageBase64Data = data.data[0].b64_json;
       
       // Midjourney from RouterHub usually returns either URL or b64
       // We must map it back to Gemini format for our proxy
       returnedData = {
          candidates: [{
             content: {
               parts: [
                 {
                   inlineData: {
                     mimeType: "image/png",
                     data: imageBase64Data || imageOutputUrl // Frontend will need to handle URL or Base64 appropriately
                   }
                 }
               ]
             }
          }]
       };

       // Special case if Routerhub returned URL, we can fetch it as base64 on server side to comply with frontend expectations
       if (imageOutputUrl && !imageBase64Data) {
         try {
           const imgRes = await fetch(imageOutputUrl);
           const arrayBuf = await imgRes.arrayBuffer();
           const buffer = Buffer.from(arrayBuf);
           returnedData.candidates[0].content.parts[0].inlineData.data = buffer.toString('base64');
         } catch(e) {
           console.error("Failed to fetch generated image URL to base64", e);
         }
       }
    }

    const returnHeaders: any = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
    returnHeaders['X-Proxy-Provider'] = baseUrl.includes("routerhub") ? "routerhub" : "google";

    return new Response(JSON.stringify(returnedData), {
      status: 200,
      headers: returnHeaders
    });
  } catch (e: any) {
     console.error("RouterHub proxy error:", e);
     return new Response(JSON.stringify({ error: { message: e.message } }), {
       status: 500,
       headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
     });
  }
}
