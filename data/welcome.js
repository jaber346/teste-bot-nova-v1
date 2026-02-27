// data/welcome.js
const fs = require("fs");
const path = require("path");
const config = require("../config");

const dbPath = path.join(__dirname, "./welcome.json");

function readDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ welcome: false, goodbye: false }, null, 2));
  }
  return JSON.parse(fs.readFileSync(dbPath));
}

function normJid(jid = "") {
  jid = String(jid || "");
  if (jid.includes(":") && jid.includes("@")) {
    const [l, r] = jid.split("@");
    return l.split(":")[0] + "@" + r;
  }
  return jid;
}

module.exports = async (sock, upd) => {
  try {
    const db = readDb();
    const groupId = upd.id;
    const action = upd.action;
    const users = upd.participants || [];

    if (!groupId.endsWith("@g.us")) return;

    const meta = await sock.groupMetadata(groupId);
    const groupName = meta.subject;
    const totalMembers = meta.participants.length;

    for (let user of users) {
      user = normJid(user);

      const mention = [user];

      let pp;
      try {
        pp = await sock.profilePictureUrl(user, "image");
      } catch {
        pp = null;
      }

      if (action === "add" && db.welcome) {
        await sock.sendMessage(groupId, {
          image: pp ? { url: pp } : undefined,
          caption:
`🎉 *BIENVENUE*

👤 @${user.split("@")[0]}
🏷 Groupe : ${groupName}
👥 Membres : ${totalMembers}

Bienvenue dans la famille !`,
          mentions: mention
        });
      }

      if (action === "remove" && db.goodbye) {
        await sock.sendMessage(groupId, {
          image: pp ? { url: pp } : undefined,
          caption:
`👋 *AU REVOIR*

👤 @${user.split("@")[0]}
🏷 Groupe : ${groupName}

Nous te souhaitons bonne continuation.`,
          mentions: mention
        });
      }
    }
  } catch (e) {
    console.log("WELCOME ERROR:", e);
  }
};