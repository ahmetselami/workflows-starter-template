const LANGUAGES = {
  tr: 'Turkish', en: 'English', de: 'German', fr: 'French',
  es: 'Spanish', it: 'Italian', pt: 'Portuguese', ru: 'Russian',
  ar: 'Arabic', zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
  nl: 'Dutch', pl: 'Polish', sv: 'Swedish'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // GÖRSEL PANEL (DASHBOARD)
    if (url.pathname === '/translate' || url.pathname === '/translate/') {
      return new Response(this.getDashboardHTML(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // API ÇEVİRİ NOKTASI
    if (url.pathname === '/translate/do' && request.method === 'POST') {
      try {
        const { text, source, target } = await request.json();
        const response = await env.AI.run('@cf/meta/m2m100-1.2b', {
          text,
          source_lang: source,
          target_lang: target
        });
        return Response.json(response);
      } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
      }
    }

    return new Response("Lenitsa API Aktif. Panele gitmek için /translate adresini kullanın.");
  },

  getDashboardHTML() {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lenitsa Translation Control Center</title>
        <meta charset="UTF-8">
        <style>
          body { background: #1a1a1a; color: #fff; font-family: sans-serif; display: flex; justify-content: center; padding: 50px; }
          .card { background: #2d2d2d; padding: 30px; border-radius: 15px; border-top: 5px solid #f48120; width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          h1 { color: #f48120; margin-top: 0; }
          .status { display: inline-block; padding: 5px 10px; background: #27ae60; border-radius: 5px; font-size: 12px; margin-bottom: 20px; }
          .lang-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
          .lang-item { background: #3d3d3d; padding: 5px; border-radius: 3px; font-size: 11px; text-align: center; }
          .info { border-top: 1px solid #444; padding-top: 20px; color: #aaa; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Lenitsa Translate v2.0</h1>
          <div class="status">SİSTEM AKTİF</div>
          <p>Yapay Zeka Destekli Çeviri Motoru</p>
          <div class="lang-grid">
            ${Object.keys(LANGUAGES).map(l => `<div class="lang-item">${l.toUpperCase()} - ${LANGUAGES[l]}</div>`).join('')}
          </div>
          <div class="info">
            <strong>Endpoint:</strong> /translate/do<br>
            <strong>Altyapı:</strong> Cloudflare Workers AI + M2M100
          </div>
        </div>
      </body>
      </html>
    `;
  }
};
