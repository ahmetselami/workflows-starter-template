export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Test yolu: /translate?text=Hello&lang=tr
    if (url.pathname === "/translate") {
      const text = url.searchParams.get("text");
      const lang = url.searchParams.get("lang") || "tr";

      if (!text) return new Response("Lütfen 'text' parametresi ekleyin.");

      try {
        // Cloudflare AI Modelini çalıştırır
        const response = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
          messages: [
            { role: "system", content: `Sen profesyonel bir e-ticaret çevirmenisin. Metni sadece ${lang} diline çevir. Asla yorum yapma, sadece çeviriyi ver.` },
            { role: "user", content: text }
          ],
        });

        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response("AI Hatası: " + e.message, { status: 500 });
      }
    }

    return new Response("Lenitsa Çeviri Sistemi Aktif. Kullanım: /translate?text=Metin&lang=Dil");
  },
};
