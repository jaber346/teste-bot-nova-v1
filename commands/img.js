// ==================== commands/img.js ====================
// Google Image Scraper (sans API) - renvoie des miniatures gstatic

import axios from "axios";

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function uniq(arr) {
  return [...new Set(arr)];
}

async function fetchGoogleThumbs(query) {
  // Google Images (tbm=isch)
  const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}&hl=fr`;

  const res = await axios.get(url, {
    headers: {
      // UA important pour éviter blocage direct
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    timeout: 20000
  });

  const html = String(res.data || "");

  // On récupère des URLs de thumbnails gstatic (plus simple et stable que parser le JSON)
  // Ex: https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9Gc...
  const matches = html.match(
    /https:\/\/encrypted-tbn0\.gstatic\.com\/images\?q=tbn:[^"&]+/g
  );

  const thumbs = uniq(matches || []);
  return thumbs;
}

async function imgCommand(sock, m, msg, args, extra) {
  try {
    if (!args.length) {
      return sock.sendMessage(
        m.chat,
        { text: "❌ Utilisation : *.img mot_clé* \nEx: *.img lion* \nOption: *.img lion 3* (image #3)" },
        { quoted: m }
      );
    }

    // Support: .img chat 3  (le dernier chiffre = index optionnel)
    let idx = null;
    const last = args[args.length - 1];
    if (/^\d+$/.test(last)) {
      idx = parseInt(last, 10);
      args = args.slice(0, -1);
    }

    const query = args.join(" ").trim();
    if (!query) {
      return sock.sendMessage(m.chat, { text: "❌ Donne un mot clé." }, { quoted: m });
    }

    const thumbs = await fetchGoogleThumbs(query);

    if (!thumbs.length) {
      return sock.sendMessage(
        m.chat,
        { text: "❌ Aucune image trouvée Réessaie avec un autre mot clé." },
        { quoted: m }
      );
    }

    let chosen;
    if (idx !== null) {
      // idx 1..N
      const i = Math.max(1, Math.min(idx, thumbs.length)) - 1;
      chosen = thumbs[i];
    } else {
      chosen = pick(thumbs);
    }

    await sock.sendMessage(
      m.chat,
      {
        image: { url: chosen },
        caption: `🖼️ *NOVA XMD V1* Image: *${query}*\n📌 Résultats: ${thumbs.length}${idx ? `\n✅ Image #${idx}` : ""}`
      },
      { quoted: m }
    );
  } catch (e) {
    console.error("IMG SCRAPER ERROR:", e?.message || e);
    const msgErr =
      String(e?.message || "").includes("status code 429")
        ? "❌Attends un peu ou change de mot clé."
        : "❌ Erreur lors du scraping Images.";

    await sock.sendMessage(m.chat, { text: msgErr }, { quoted: m });
  }
}

export default {
  name: "img",
  category: "Recherche",
  run: imgCommand
};