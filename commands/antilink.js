// commands/antilink.js
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "../data/antilink.json");

function ensureDb() {
  if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
}

function readDb() {
  ensureDb();
  try {
    const j = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

function writeDb(arr) {
  fs.writeFileSync(dbPath, JSON.stringify(arr, null, 2));
}

module.exports = {
  name: "antilink",
  category: "Security",
  description: "Antilink on/off (supprime les liens)",

  async execute(sock, m, args, { prefix, isGroup } = {}) {
    const from = m.key.remoteJid;
    if (!isGroup) {
      return sock.sendMessage(from, { text: "❌ Groupe uniquement." }, { quoted: m });
    }

    const sub = (args[0] || "").toLowerCase();
    let db = readDb();

    if (sub === "on") {
      if (!db.includes(from)) db.push(from);
      writeDb(db);
      return sock.sendMessage(from, { text: "✅ Antilink activé (DELETE)." }, { quoted: m });
    }

    if (sub === "off") {
      db = db.filter((x) => x !== from);
      writeDb(db);
      return sock.sendMessage(from, { text: "❌ Antilink désactivé." }, { quoted: m });
    }

    return sock.sendMessage(from, { text: `Utilisation : ${prefix}antilink on/off` }, { quoted: m });
  }
};