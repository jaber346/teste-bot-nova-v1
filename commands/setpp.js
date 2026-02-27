// commands/setpp.js
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const config = require("../config");

function normJid(jid = "") {
  jid = String(jid || "");
  if (!jid) return jid;
  if (jid.includes(":") && jid.includes("@")) {
    const [l, r] = jid.split("@");
    return l.split(":")[0] + "@" + r;
  }
  return jid;
}

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

// ✅ ne bloque pas sur "admin", on essaye puis on catch
async function tryAction(fn, onFail) {
  try {
    return await fn();
  } catch (e) {
    const msg = String(e?.message || e);
    const status = e?.output?.statusCode || e?.data?.status || "";
    const adminLikely =
      /not-authorized|forbidden|unauthorized|admin|permission|403/i.test(msg) ||
      status === 403;

    if (adminLikely) {
      return onFail?.("❌ WhatsApp a refusé l’action (droits insuffisants). Mets le numéro/bot admin puis réessaie.");
    }
    return onFail?.("❌ Erreur. Réessaie.");
  }
}

// ============ quoted helpers ============
function getContextInfo(m) {
  return m.message?.extendedTextMessage?.contextInfo || {};
}

function getQuotedMessage(m) {
  const ctx = getContextInfo(m);
  return ctx.quotedMessage || null;
}

// image dans quoted (support viewOnce)
function getQuotedImageMessage(m) {
  const q = getQuotedMessage(m);
  if (!q) return null;

  if (q.imageMessage) return q.imageMessage;

  const vo = q.viewOnceMessageV2 || q.viewOnceMessage;
  const inner = vo?.message || {};
  if (inner.imageMessage) return inner.imageMessage;

  return null;
}

async function imageMsgToBuffer(imgMsg) {
  const stream = await downloadContentFromMessage(imgMsg, "image");
  let buffer = Buffer.from([]);
  for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
  return buffer;
}

// ✅ cible PP:
// - mention
// - reply (ctx.participant)
// - DM => from (la personne en face)
function getTargetJidForProfile(m) {
  const from = normJid(m.key?.remoteJid || "");
  const isGroup = from.endsWith("@g.us");

  const ctx = getContextInfo(m);

  const mentioned = ctx.mentionedJid?.[0];
  if (mentioned) return normJid(mentioned);

  const participant = ctx.participant; // souvent présent en groupe quand tu reply
  if (participant) return normJid(participant);

  // ✅ DM: la cible c’est la personne en face (remoteJid)
  if (!isGroup && from.endsWith("@s.whatsapp.net")) return from;

  return null;
}

async function getProfileUrl(sock, jid) {
  try {
    return await sock.profilePictureUrl(jid, "image");
  } catch {
    return null;
  }
}

module.exports = {
  name: "setpp",
  category: "Group",
  description: "Changer photo groupe (reply image) OU envoyer la PP d'un membre (tag/reply/pv)",

  async execute(sock, m, args, extra = {}) {
    const from = normJid(m.key?.remoteJid || "");
    const isGroup = from.endsWith("@g.us");

    // owner check fiable
    const ownerJid = String(config.OWNER_NUMBER || "").replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    const sender = normJid(m.key?.participant || m.sender || from);
    const isOwner = Boolean(extra?.isOwner) || sender === normJid(ownerJid) || m.key?.fromMe === true;

    const botJid = normJid(sock.user?.id || "");

    // ✅ Si reply image => change PP (groupe) ou bot (DM owner)
    const imgMsg = getQuotedImageMessage(m);

    if (imgMsg) {
      // ----- GROUPE : change PP du groupe -----
      if (isGroup) {
        return tryAction(
          async () => {
            const buffer = await imageMsgToBuffer(imgMsg);
            await sock.updateProfilePicture(from, buffer);
            return sock.sendMessage(
              from,
              { text: "✅ Photo du groupe mise à jour.", contextInfo: newsletterCtx() },
              { quoted: m }
            );
          },
          async (txt) => sock.sendMessage(from, { text: txt, contextInfo: newsletterCtx() }, { quoted: m })
        );
      }

      // ----- DM : change PP du bot (owner only) -----
      if (!isOwner) {
        return sock.sendMessage(from, { text: "🚫 Owner seulement pour changer la photo du bot.", contextInfo: newsletterCtx() }, { quoted: m });
      }

      return tryAction(
        async () => {
          const buffer = await imageMsgToBuffer(imgMsg);
          await sock.updateProfilePicture(botJid, buffer);
          return sock.sendMessage(from, { text: "✅ Photo du bot mise à jour.", contextInfo: newsletterCtx() }, { quoted: m });
        },
        async (txt) => sock.sendMessage(from, { text: txt, contextInfo: newsletterCtx() }, { quoted: m })
      );
    }

    // ✅ Sinon => envoyer la PP de quelqu’un (tag/reply/DM)
    const target = getTargetJidForProfile(m);

    if (!target) {
      return sock.sendMessage(
        from,
        {
          text:
`Utilisation :
- ${config.PREFIX || "."}setpp @tag
- Reply quelqu’un puis ${config.PREFIX || "."}setpp
- En PV: ${config.PREFIX || "."}setpp`,
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );
    }

    const url = await getProfileUrl(sock, target);

    if (!url) {
      return sock.sendMessage(
        from,
        { text: "❌ Photo de profil invisible (privacy) ou pas de PP.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    return sock.sendMessage(
      from,
      {
        image: { url },
        caption:
`╭━━〔 🖼️ PROFILE PHOTO 〕━━╮
┃ 👤 User : @${target.split("@")[0]}
╰━━━━━━━━━━━━━━━━━━━━━━╯`,
        mentions: [target],
        contextInfo: newsletterCtx()
      },
      { quoted: m }
    );
  }
};