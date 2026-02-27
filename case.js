const fs = require("fs");
const path = require("path");
const config = require("./config");

// ✅ ANTILINK DELETE HANDLER
let antilinkHandler = async () => {};
try { antilinkHandler = require("./data/antilink.js"); } catch {}

// ================= COMMAND LOADER =================
const commands = new Map();
const commandsDir = path.join(__dirname, "commands");

function loadAllCommands() {
  commands.clear();
  if (!fs.existsSync(commandsDir)) return;

  for (const file of fs.readdirSync(commandsDir)) {
    if (!file.endsWith(".js")) continue;

    try {
      const full = path.join(commandsDir, file);
      delete require.cache[require.resolve(full)];
      const cmd = require(full);

      const name = (cmd?.name || "").toLowerCase();
      const exec = cmd?.execute || cmd?.run;

      if (name && typeof exec === "function") {
        commands.set(name, { ...cmd, _exec: exec });
      }
    } catch (err) {
      console.log("CMD LOAD ERROR:", file, err?.message || err);
    }
  }
}
loadAllCommands();

// ================= HELPERS =================
function normJid(jid = "") {
  jid = String(jid || "");
  if (!jid) return jid;
  // remove device id :xx
  if (jid.includes(":") && jid.includes("@")) {
    const [l, r] = jid.split("@");
    return l.split(":")[0] + "@" + r;
  }
  return jid;
}

function getSender(m) {
  return normJid(m.key?.participant || m.participant || m.key?.remoteJid || "");
}

function getBody(m) {
  const msg = m.message || {};
  const type = Object.keys(msg)[0];
  if (!type) return "";

  // ✅ Ephemeral wrapper
  if (type === "ephemeralMessage") {
    const inner = msg.ephemeralMessage?.message || {};
    return getBody({ message: inner, key: m.key });
  }

  if (type === "conversation") return msg.conversation || "";
  if (type === "extendedTextMessage") return msg.extendedTextMessage?.text || "";
  if (type === "imageMessage") return msg.imageMessage?.caption || "";
  if (type === "videoMessage") return msg.videoMessage?.caption || "";
  if (type === "documentMessage") return msg.documentMessage?.caption || "";

  // ✅ Buttons / List / Template replies
  if (type === "buttonsResponseMessage") {
    return (
      msg.buttonsResponseMessage?.selectedButtonId ||
      msg.buttonsResponseMessage?.selectedDisplayText ||
      ""
    );
  }
  if (type === "listResponseMessage") {
    return (
      msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
      msg.listResponseMessage?.title ||
      ""
    );
  }
  if (type === "templateButtonReplyMessage") {
    return (
      msg.templateButtonReplyMessage?.selectedId ||
      msg.templateButtonReplyMessage?.selectedDisplayText ||
      ""
    );
  }

  // ✅ ViewOnce wrapper
  if (type === "viewOnceMessageV2" || type === "viewOnceMessage") {
    const inner = msg[type]?.message || {};
    const innerType = Object.keys(inner)[0];
    if (!innerType) return "";
    if (innerType === "imageMessage") return inner.imageMessage?.caption || "";
    if (innerType === "videoMessage") return inner.videoMessage?.caption || "";
    return "";
  }

  return "";
}

// Persist prefix (optional)
function savePrefixToConfigFile(newPrefix) {
  try {
    const configPath = path.join(__dirname, "config.js");
    if (!fs.existsSync(configPath)) return;

    let content = fs.readFileSync(configPath, "utf8");
    content = content.replace(/PREFIX\s*:\s*["'`].*?["'`]/, `PREFIX: "${newPrefix}"`);
    fs.writeFileSync(configPath, content, "utf8");
  } catch {
    // ignore
  }
}

async function buildGroupContext(sock, from, sender) {
  try {
    const metadata = await sock.groupMetadata(from);
    const participants = metadata?.participants || [];
    const senderN = normJid(sender);

    const admins = participants
      .filter((p) => p.admin)
      .map((p) => normJid(p.id));

    const botJid = normJid(sock.user?.id || "");

    const isBotAdmin = admins.includes(botJid);
    const isAdmin = admins.includes(senderN);

    return {
      metadata,
      participants,
      admins,
      isBotAdmin,
      isAdmin,
    };
  } catch {
    return {
      metadata: null,
      participants: [],
      admins: [],
      isBotAdmin: false,
      isAdmin: false,
    };
  }
}

// ================= MAIN HANDLER =================
module.exports = async (sock, m, prefix, setMode, currentMode) => {
  try {
    if (!m || !m.message) return;

    const from = m.key.remoteJid;
    const isGroup = from.endsWith("@g.us");
    const sender = getSender(m);

    const botJid = normJid(sock.user?.id || "");
    const ownerJid = String(config.OWNER_NUMBER || "").replace(/[^0-9]/g, "") + "@s.whatsapp.net";

    const isOwner =
      m.key.fromMe === true ||
      normJid(sender) === normJid(ownerJid) ||
      normJid(sender) === normJid(botJid);

    const usedPrefix = prefix || config.PREFIX || ".";
    const body = (getBody(m) || "").trim();
    if (!body) return;

    const reply = (text) => sock.sendMessage(from, { text }, { quoted: m });

    // ✅ ANTI-LINK DELETE (même si ce n’est pas une commande)
    // Important: on le fait AVANT le return !isCmd
    try {
      await antilinkHandler(sock, m, from, body);
    } catch {}

    const isCmd = body.startsWith(usedPrefix);
    if (!isCmd) return;

    if (String(currentMode).toLowerCase() === "self" && !isOwner) return;

    const parts = body.slice(usedPrefix.length).trim().split(/\s+/);
    const command = (parts.shift() || "").toLowerCase();
    const args = parts;

    // reload live
    if (command === "reload" && isOwner) {
      loadAllCommands();
      return reply("✅ Commands rechargées.");
    }

    // built-in ping
    if (command === "ping") {
      const start = Date.now();
      const modeText = (currentMode || "public").toUpperCase();

      return reply(
`╭━━〔 🤖 NOVA XMD V1 〕━━╮
┃ 🏓 𝙿𝙸𝙽𝙶
┣━━━━━━━━━━━━━━━━━━
┃ ⚡ Speed : ${Date.now() - start} ms
┃ 🌐 Mode  : ${modeText}
┃ 🟢 Status: ONLINE
╰━━━━━━━━━━━━━━━━━━╯`
      );
    }

    // built-in mode
    if (command === "mode") {
      if (!isOwner) return reply("🚫 Commande réservée au propriétaire.");
      const mode = (args[0] || "").toLowerCase();

      if (mode === "public") {
        setMode("public");
        return reply("🔓 Mode PUBLIC activé.");
      }
      if (mode === "private" || mode === "prive" || mode === "self") {
        setMode("self");
        return reply("🔒 Mode PRIVÉ (SELF) activé.");
      }
      return reply(`Utilisation :\n${usedPrefix}mode public\n${usedPrefix}mode private`);
    }

    // built-in setprefix
    if (command === "setprefix") {
      if (!isOwner) return reply("🚫 Commande réservée au propriétaire.");
      const newP = args[0];
      if (!newP) return reply(`Utilisation : ${usedPrefix}setprefix .`);

      config.PREFIX = newP;
      savePrefixToConfigFile(newP);
      return reply(`✅ Prefix changé : *${newP}*`);
    }

    // group context (only for group commands)
    let groupCtx = {};
    if (isGroup) {
      groupCtx = await buildGroupContext(sock, from, sender);
    }

    const cmd = commands.get(command);
    if (cmd) {
      return await cmd._exec(sock, m, args, {
        prefix: usedPrefix,
        currentMode,
        setMode,
        isOwner,
        isGroup,
        sender,
        from,
        reply,
        ...groupCtx,
        isAdminOrOwner: (groupCtx?.isAdmin || isOwner),
      });
    }

    // unknown command: ignore
  } catch (err) {
    console.log("CASE ERROR:", err?.message || err);
  }
};