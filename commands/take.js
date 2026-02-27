// commands/take.js
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

function getQuotedSticker(m) {
  const ctx = m.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  if (!quoted) return null;

  if (quoted.stickerMessage) return quoted.stickerMessage;

  if (quoted.viewOnceMessageV2 || quoted.viewOnceMessage) {
    const inner = (quoted.viewOnceMessageV2 || quoted.viewOnceMessage)?.message || {};
    if (inner.stickerMessage) return inner.stickerMessage;
  }

  return null;
}

async function stickerToBuffer(stickerMsg) {
  const stream = await downloadContentFromMessage(stickerMsg, "sticker");
  let buffer = Buffer.from([]);
  for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
  return buffer;
}

module.exports = {
  name: "take",
  category: "Sticker",
  description: "Changer packname et author d’un sticker (reply sticker)",

  async execute(sock, m, args) {
    const from = m.key.remoteJid;

    const stickerMsg = getQuotedSticker(m);
    if (!stickerMsg) {
      return sock.sendMessage(
        from,
        { text: "⚠️ Réponds à un sticker avec .take pack|author", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    const text = args.join(" ");
    if (!text.includes("|")) {
      return sock.sendMessage(
        from,
        { text: "❌ Format : .take PackName|Author", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    const [packname, author] = text.split("|").map(v => v.trim());

    try {
      const buffer = await stickerToBuffer(stickerMsg);

      await sock.sendMessage(
        from,
        {
          sticker: buffer,
          packname: packname || config.BOT_NAME || "",
          author: author || "",
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );
    } catch (e) {
      return sock.sendMessage(
        from,
        { text: "❌ Erreur lors du traitement du sticker.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }
  }
};