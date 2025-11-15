import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ROI {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  unit?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, rois } = await req.json();
    
    if (!imageBase64) {
      throw new Error('Image data is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build detailed prompt with ROI information
    const roiDescriptions = rois.map((roi: ROI) => 
      `${roi.label}: located at coordinates (${(roi.x * 100).toFixed(0)}%, ${(roi.y * 100).toFixed(0)}%) with dimensions ${(roi.width * 100).toFixed(0)}% x ${(roi.height * 100).toFixed(0)}%${roi.unit ? `, unit: ${roi.unit}` : ''}`
    ).join('\n');

    const prompt = `You are analyzing a medical patient monitor display. Extract the exact numerical values for the following vital signs from their specific screen locations:

${roiDescriptions}

CRITICAL INSTRUCTIONS:
- Return ONLY valid JSON, no explanations or markdown
- Extract ONLY the numeric values you can clearly see
- For blood pressure readings (ABP, PAP), return as "systolic/diastolic/mean" format (e.g., "120/80/93")
- If a value is not clearly visible, use null
- Be precise with the numbers shown on the display

Return JSON format:
{
  "HR": number or null,
  "Pulse": number or null,
  "SpO2": number or null,
  "ABP": "sys/dia/mean" or null,
  "PAP": "sys/dia/mean" or null,
  "EtCO2": number or null,
  "awRR": number or null
}`;

    console.log('Sending request to Lovable AI...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', errorText);
      throw new Error(`Lovable AI request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('Lovable AI response:', JSON.stringify(data, null, 2));

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in Lovable AI response');
    }

    // Parse the JSON response, cleaning any markdown formatting
    let vitalsData;
    try {
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      vitalsData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse vitals data:', content);
      throw new Error('Failed to parse vitals from response');
    }

    return new Response(JSON.stringify({ vitals: vitalsData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in extract-vitals function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});