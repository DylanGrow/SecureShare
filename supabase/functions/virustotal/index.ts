import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const hash = url.searchParams.get('hash');
    if (!hash) {
      return new Response(JSON.stringify({ error: 'Missing hash parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('VIRUSTOTAL_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'VIRUSTOTAL_API_KEY is not set on the server.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Query VirusTotal API v3 for the hash
    const vtResponse = await fetch(`https://www.virustotal.com/api/v3/files/${hash}`, {
      headers: {
        'x-apikey': apiKey,
      },
    });

    if (vtResponse.status === 404) {
      // Hash not found on VirusTotal (never scanned)
      return new Response(JSON.stringify({ status: 'not_found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!vtResponse.ok) {
      const errText = await vtResponse.text();
      throw new Error(`VirusTotal API responded with status ${vtResponse.status}: ${errText}`);
    }

    const vtData = await vtResponse.json();
    return new Response(JSON.stringify({ status: 'success', data: vtData.data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
