// commands/coran.js
const config = require("../config");

function newsletterCtx() {
  return {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: "120363423249667073@newsletter",
      newsletterName: config.BOT_NAME || "NOVA XMD V1",
      serverMessageId: 1
    }
  };
}

function onlyNum(x) {
  const n = parseInt(String(x || "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

// ✅ Reciter: Abdullah Al-Matrood (EveryAyah)
// Si un jour tu veux changer, je te donne d’autres réciteurs.
function buildMatroodMp3Url(surahNumber) {
  return `https://everyayah.com/data/Abdullah_Al_Matrood_128kbps/${pad3(surahNumber)}.mp3`;
}

module.exports = {
  name: "coran",
  category: "Islam",
  description: "Envoyer l'audio MP3 d'une sourate. Ex: .coran 1",

  async execute(sock, m, args) {
    const from = m.key.remoteJid;

    const surah = onlyNum(args[0]);
    if (!surah || surah < 1 || surah > 114) {
      return sock.sendMessage(
        from,
        { text: `Utilisation : ${config.PREFIX || "."}coran 1-114`, contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    try {
      const mp3 = buildMatroodMp3Url(surah);

      await sock.sendMessage(
        from,
        {
          text: `🎧 *Coran Audio*\n📖 Sourate : *${surah}*\n👳‍♂️ Réciteur : *Abdullah Al-Matrood*`,
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );

      return sock.sendMessage(
        from,
        {
          audio: { url: mp3 },
          mimetype: "audio/mpeg",
          ptt: false,
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );
    } catch (e) {
      return sock.sendMessage(
        from,
        { text: "❌ Impossible d'envoyer l'audio maintenant. Réessaie.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }
  }
};