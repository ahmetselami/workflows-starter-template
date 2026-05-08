const LANGUAGES = {
  tr: 'Turkish', en: 'English', de: 'German', fr: 'French',
  es: 'Spanish', it: 'Italian', pt: 'Portuguese', ru: 'Russian',
  ar: 'Arabic', zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
  nl: 'Dutch', pl: 'Polish', sv: 'Swedish'
};

const DASHBOARD_CONFIG = {
  title: 'Lenitsa Translate v2.0',
  status: 'SİSTEM AKTİF',
  description: 'Yapay Zeka Destekli Çeviri Motoru',
  endpoint: '/translate/do',
  infrastructure: 'Cloudflare Workers AI + M2M100'
};

const DASHBOARD_STYLES = `
  body { background: #1a1a1a; color: #fff; font-family: sans-serif; display: flex; justify-content: center; padding: 50px; }
  .card { background: #2d2d2d; padding: 30px; border-radius: 15px; border-top: 5px solid #f48120; width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
  h1 { color: #f48120; margin-top: 0; }
  .status { display: inline-block; padding: 5px 10px; background: #27ae60; border-radius: 5px; font-size: 12px; margin-bottom: 20px; }
  .lang-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
  .lang-item { background: #3d3d3d; padding: 5px; border-radius: 3px; font-size: 11px; text-align: center; }
  .info { border-top: 1px solid #444; padding-top: 20px; color: #aaa; font-size: 13px; }
`;

const API_CONFIG = {
  MODEL: '@cf/meta/m2m100-1.2b',
  KV_NAMESPACE: 'TRANSLATIONS_KV',
  CACHE_TTL: 86400 // 24 hours
};

const ERRORS = {
  INVALID_REQUEST: { status: 400, message: 'Invalid request body' },
  MISSING_FIELDS: { status: 400, message: 'Missing required fields: text, source, target' },
  INVALID_LANGUAGE: { status: 400, message: 'Invalid source or target language' },
  AI_ERROR: { status: 500, message: 'Translation service error' },
  KV_ERROR: { status: 500, message: 'Cache service error' },
  NOT_FOUND: { status: 404, message: 'Endpoint not found' }
};

interface TranslationRequest {
  text: string;
  source: string;
  target: string;
}

interface TranslationResponse {
  success: boolean;
  translated_text?: string;
  error?: string;
  cached?: boolean;
}

interface Env {
  AI: Cloudflare.AI;
  TRANSLATIONS_KV: KVNamespace;
}

const validateLanguage = (lang: string): boolean => lang in LANGUAGES;

const validateTranslationRequest = (body: unknown): body is TranslationRequest => {
  if (!body || typeof body !== 'object') return false;
  const req = body as Record<string, unknown>;
  return (
    typeof req.text === 'string' &&
    typeof req.source === 'string' &&
    typeof req.target === 'string' &&
    req.text.length > 0 &&
    validateLanguage(req.source) &&
    validateLanguage(req.target)
  );
};

const getCacheKey = (text: string, source: string, target: string): string => {
  return `translation:${source}:${target}:${text.substring(0, 50)}`;
};

const handleTranslation = async (
  request: TranslationRequest,
  env: Env
): Promise<TranslationResponse> => {
  const { text, source, target } = request;
  const cacheKey = getCacheKey(text, source, target);

  try {
    // Check cache first
    const cached = await env.TRANSLATIONS_KV.get(cacheKey);
    if (cached) {
      return {
        success: true,
        translated_text: cached,
        cached: true
      };
    }
  } catch (error) {
    console.error('KV cache read error:', error);
    // Continue without cache on error
  }

  try {
    const response = await env.AI.run(API_CONFIG.MODEL, {
      text,
      source_lang: source,
      target_lang: target
    });

    const translatedText = (response as Record<string, unknown>).translated_text as string;

    // Cache the result
    try {
      await env.TRANSLATIONS_KV.put(cacheKey, translatedText, {
        expirationTtl: API_CONFIG.CACHE_TTL
      });
    } catch (error) {
      console.error('KV cache write error:', error);
      // Non-fatal error
    }

    return {
      success: true,
      translated_text: translatedText,
      cached: false
    };
  } catch (error) {
    console.error('AI translation error:', error);
    return {
      success: false,
      error: ERRORS.AI_ERROR.message
    };
  }
};

const responseJSON = (data: unknown, status = 200): Response => {
  return Response.json(data, {
    status,
    headers: { 'Content-Type': 'application/json;charset=UTF-8' }
  });
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // DASHBOARD
    if (url.pathname === '/translate' || url.pathname === '/translate/') {
      return new Response(this.getDashboardHTML(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // TRANSLATION API
    if (url.pathname === '/translate/do' && request.method === 'POST') {
      try {
        const body = await request.json();

        if (!validateTranslationRequest(body)) {
          if (!body.text || !body.source || !body.target) {
            return responseJSON(
              { success: false, error: ERRORS.MISSING_FIELDS.message },
              ERRORS.MISSING_FIELDS.status
            );
          }
          return responseJSON(
            { success: false, error: ERRORS.INVALID_LANGUAGE.message },
            ERRORS.INVALID_LANGUAGE.status
          );
        }

        const result = await handleTranslation(body, env);
        const status = result.success ? 200 : 500;
        return responseJSON(result, status);
      } catch (error) {
        console.error('Request parsing error:', error);
        return responseJSON(
          { success: false, error: ERRORS.INVALID_REQUEST.message },
          ERRORS.INVALID_REQUEST.status
        );
      }
    }

    // Health check
    if (url.pathname === '/health') {
      return responseJSON({ status: 'ok' });
    }

    // Not Found
    return responseJSON(
      { success: false, error: ERRORS.NOT_FOUND.message },
      ERRORS.NOT_FOUND.status
    );
  },

  getDashboardHTML(): string {
    const languageItems = Object.entries(LANGUAGES)
      .map(([code, name]) => `<div class="lang-item">${code.toUpperCase()} - ${name}</div>`)
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${DASHBOARD_CONFIG.title}</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>${DASHBOARD_STYLES}</style>
      </head>
      <body>
        <div class="card">
          <h1>${DASHBOARD_CONFIG.title}</h1>
          <div class="status">${DASHBOARD_CONFIG.status}</div>
          <p>${DASHBOARD_CONFIG.description}</p>
          <div class="lang-grid">${languageItems}</div>
          <div class="info">
            <strong>Endpoint:</strong> ${DASHBOARD_CONFIG.endpoint}<br>
            <strong>Altyapı:</strong> ${DASHBOARD_CONFIG.infrastructure}<br>
            <strong>Health:</strong> /health
          </div>
        </div>
      </body>
      </html>
    `;
  }
};
