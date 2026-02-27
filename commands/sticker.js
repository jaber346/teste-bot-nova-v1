// commands/sticker.js
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const config = require("../config");

function newsletterCtx() {
  return {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: "",
      newsletterName: config.BOT_NAME || "NOVA XMD V1",
      serverMessageId: 1
    }
  };
}

// -------- helpers quoted / media --------
function getContextInfo(m) {
  return m.message?.extendedTextMessage?.contextInfo || {};
}
function getQuotedMessage(m) {
  const ctx = getContextInfo(m);
  return ctx.quotedMessage || null;
}

function pickMediaFromMessage(msg) {
  if (!msg) return null;

  // direct media
  if (msg.imageMessage) return { type: "image", media: msg.imageMessage };
  if (msg.videoMessage) return { type: "video", media: msg.videoMessage };

  // viewOnce wrapper
  if (msg.viewOnceMessageV2 || msg.viewOnceMessage) {
    const inner = (msg.viewOnceMessageV2 || msg.viewOnceMessage)?.message || {};
    if (inner.imageMessage) return { type: "image", media: inner.imageMessage };
    if (inner.videoMessage) return { type: "video", media: inner.videoMessage };
  }

  // ephemeral wrapper
  if (msg.ephemeralMessage?.message) {
    return pickMediaFromMessage(msg.ephemeralMessage.message);
  }

  return null;
}

async function toBuffer(media, type) {
  const stream = await downloadContentFromMessage(media, type);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
  return buffer;
}

module.exports = {
  name: "sticker",
  alias: ["s", "stiker", "stick"],
  category: "Tools",
  description: "Image/vidéo -> sticker (reply ou direct)",

  async execute(sock, m, args, extra = {}) {
    const from = m.key.remoteJid;

    // 1) essayer média du message actuel
    let picked = pickMediaFromMessage(m.message);

    // 2) sinon, média du message cité
    if (!picked) {
      const q = getQuotedMessage(m);
      picked = pickMediaFromMessage(q);
    }

    // 3) Si pas de média => sticker texte (si args)
    if (!picked) {
      const text = (args || []).join(" ").trim();
      if (!text) {
        return sock.sendMessage(
          from,
          { text: `⚠️ Utilisation :\n- Réponds à une image/vidéo avec *${config.PREFIX || "."}sticker*\n- Ou: *${config.PREFIX || "."}sticker Bonjour*` , contextInfo: newsletterCtx() },
          { quoted: m }
        );
      }

      // Sticker texte (simple)
      return sock.sendMessage(
        from,
        {
          sticker: { url: `https://api.davidcyriltech.my.id/sticker?text=${encodeURIComponent(text)}` },
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );
    }

    // Limite vidéo (WhatsApp sticker vidéo = courte)
    if (picked.type === "video") {
      const seconds = picked.media?.seconds || 0;
      if (seconds > 12) {
        return sock.sendMessage(
          from,
          { text: "❌ Vidéo trop longue. Envoie une vidéo ≤ 10 secondes pour sticker.", contextInfo: newsletterCtx() },
          { quoted: m }
        );
      }
    }

    try {
      await sock.sendMessage(from, { text: "⏳ Conversion en sticker..." }, { quoted: m });

      const buff = await toBuffer(picked.media, picked.type === "image" ? "image" : "video");

      // ✅ Envoi sticker
      return sock.sendMessage(
        from,
        {
          sticker: buff,
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );
    } catch (e) {
      return sock.sendMessage(
        from,
        { text: "❌ Erreur conversion sticker. (Vérifie que ffmpeg est dispo si nécessaire)", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }
  }
};