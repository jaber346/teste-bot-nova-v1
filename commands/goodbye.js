// commands/goodbye.js
const fs = require("fs");
const path = require("path");
const config = require("../config");

const dbPath = path.join(__dirname, "../data/welcome.json");

function ensureDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ welcome: false, goodbye: false }, null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch {
    return { welcome: false, goodbye: false };
  }
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

module.exports = {
  name: "goodbye",
  category: "Group",
  description: "Activer/Désactiver les messages d'au revoir",

  async execute(sock, m, args, { isGroup, isOwner } = {}) {
    const from = m.key.remoteJid;

    if (!isGroup) {
      return sock.sendMessage(from, { text: "❌ Groupe uniquement." }, { quoted: m });
    }

    if (!isOwner) {
      return sock.sendMessage(from, { text: "🚫 Owner seulement." }, { quoted: m });
    }

    const sub = (args[0] || "").toLowerCase();
    const db = readDb();

    if (sub === "on") {
      db.goodbye = true;
      writeDb(db);
      return sock.sendMessage(from, { text: "✅ Goodbye activé." }, { quoted: m });
    }

    if (sub === "off") {
      db.goodbye = false;
      writeDb(db);
      return sock.sendMessage(from, { text: "❌ Goodbye désactivé." }, { quoted: m });
    }

    return sock.sendMessage(
      from,
      { text: "Utilisation : .goodbye on / off" },
      { quoted: m }
    );
  }
};