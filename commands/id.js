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

module.exports = {
  name: "id",
  category: "Tools",
  description: "Afficher ID user/groupe/newsletter",

  async execute(sock, m) {
    const from = m.key.remoteJid;

    // 🔥 Si message vient d'une newsletter
    if (from.endsWith("@newsletter")) {
      const id = from;

      const text =
`╭━━〔 📰 NEWSLETTER INFO 〕━━╮
┃ *ID:* ${id}
┃ *Name:* DEV NOVA TECH
┃ *Total Followers:* N/A
┃ *Status:* ACTIVE
┃ *Verified:* N/A
╰━━━━━━━━━━━━━━━━━━━━━━╯
by natsu tech`;

      return sock.sendMessage(from, {
        text,
        contextInfo: newsletterCtx()
      }, { quoted: m });
    }

    // 🧑 User privé
    if (from.endsWith("@s.whatsapp.net")) {
      const user = from.split("@")[0];

      return sock.sendMessage(from, {
        text:
`╭━━〔 🆔 NOVA XMD V1 〕━━╮
┃ 👤 User : ${user}
┃ 💬 Chat : ${from}
┃ 👥 Type : Privé
╰━━━━━━━━━━━━━━━━━━━━━━╯`
      }, { quoted: m });
    }

    // 👥 Groupe
    if (from.endsWith("@g.us")) {
      const meta = await sock.groupMetadata(from);

      return sock.sendMessage(from, {
        text:
`╭━━〔 🆔 GROUPE INFO 〕━━╮
┃ *ID:* ${from}
┃ *Name:* ${meta.subject}
┃ *Participants:* ${meta.participants.length}
╰━━━━━━━━━━━━━━━━━━━━━━╯`
      }, { quoted: m });
    }
  }
};