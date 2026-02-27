// commands/add.js
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

function normJid(jid = "") {
  jid = String(jid || "");
  if (jid.includes(":") && jid.includes("@")) {
    const [l, r] = jid.split("@");
    return l.split(":")[0] + "@" + r;
  }
  return jid;
}

function onlyDigits(s) {
  return String(s || "").replace(/[^0-9]/g, "");
}

function getContextInfo(m) {
  return m.message?.extendedTextMessage?.contextInfo || {};
}

function getTargetFromMentionOrReply(m) {
  const ctx = getContextInfo(m);

  // @mention
  const mentioned = ctx.mentionedJid?.[0];
  if (mentioned) return normJid(mentioned);

  // reply -> participant du message cité
  const participant = ctx.participant;
  if (participant) return normJid(participant);

  return null;
}

function extractNumberArg(args = []) {
  const raw = (args[0] || "").trim();
  if (!raw) return null;

  // si l'utilisateur met un @tag (texte), ça ne donne pas le jid => on ignore
  const digits = onlyDigits(raw);
  if (!digits || digits.length < 8) return null;

  return digits;
}

module.exports = {
  name: "add",
  category: "Group",
  description: "Ajouter un membre au groupe (numéro / mention / reply)",

  async execute(sock, m, args, extra = {}) {
    const from = normJid(m.key?.remoteJid || "");
    const isGroup = from.endsWith("@g.us");

    if (!isGroup) {
      return sock.sendMessage(
        from,
        { text: "❌ Cette commande fonctionne uniquement en groupe.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    // 1) mention/reply
    let targetJid = getTargetFromMentionOrReply(m);

    // 2) numéro en argument
    if (!targetJid) {
      const num = extractNumberArg(args);
      if (num) targetJid = num + "@s.whatsapp.net";
    }

    if (!targetJid) {
      return sock.sendMessage(
        from,
        {
          text:
`Utilisation :
- ${config.PREFIX || "."}add 225XXXXXXXX
- ${config.PREFIX || "."}add +225XXXXXXX
- Reply quelqu’un puis ${config.PREFIX || "."}add`,
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );
    }

    // ✅ tentative d’ajout (on évite les checks admin qui te bloquent)
    try {
      const res = await sock.groupParticipantsUpdate(from, [targetJid], "add");

      // Baileys renvoie parfois des codes (200/403/409/408 etc)
      // On affiche un message propre
      const status =
        res?.[0]?.status ||
        res?.[targetJid]?.status ||
        null;

      if (status === 200) {
        return sock.sendMessage(
          from,
          {
            text: `✅ Membre ajouté : @${targetJid.split("@")[0]}`,
            mentions: [targetJid],
            contextInfo: newsletterCtx()
          },
          { quoted: m }
        );
      }

      // 403 => invite only / pas le droit / paramètres groupe
      if (status === 403) {
        return sock.sendMessage(
          from,
          {
            text:
`⚠️ Impossible d’ajouter @${targetJid.split("@")[0]}.
Le groupe exige peut-être une invitation (ou le bot n’a pas les droits).`,
            mentions: [targetJid],
            contextInfo: newsletterCtx()
          },
          { quoted: m }
        );
      }

      // 409 => déjà dans le groupe
      if (status === 409) {
        return sock.sendMessage(
          from,
          {
            text: `ℹ️ @${targetJid.split("@")[0]} est déjà dans le groupe.`,
            mentions: [targetJid],
            contextInfo: newsletterCtx()
          },
          { quoted: m }
        );
      }

      // fallback
      return sock.sendMessage(
        from,
        {
          text: `⚠️ Réponse WhatsApp: ${status ?? "unknown"} (ajout non confirmé).`,
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );
    } catch (e) {
      const msg = String(e?.message || e);

      // message propre
      return sock.sendMessage(
        from,
        {
          text:
`❌ Échec d’ajout.
Raison possible: le bot n’a pas les droits ou le groupe bloque l’ajout direct.

Détail: ${msg.slice(0, 120)}`,
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );
    }
  }
};