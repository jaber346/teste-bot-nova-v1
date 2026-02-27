// commands/pair.js (SAFE FIX: keep socket alive so code stays valid)
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  delay
} = require("@whiskeysockets/baileys");

const config = require("../config");

function onlyDigits(s) {
  return String(s || "").replace(/[^0-9]/g, "");
}

// ✅ store pairing sockets so they remain alive
global.__pairSockets = global.__pairSockets || new Map();

function newsletterContext() {
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
  name: "pair",
  category: "Owner",
  description: "Générer un code de pairing WhatsApp (owner only)",

  async execute(sock, m, args, { isOwner, prefix } = {}) {
    const from = m.key.remoteJid;

    if (!isOwner) {
      return sock.sendMessage(from, { text: "🚫 Commande réservée au propriétaire." }, { quoted: m });
    }

    let num = onlyDigits(args[0]);
    if (!num || num.length < 8) {
      return sock.sendMessage(
        from,
        { text: `Utilisation : ${(prefix || config.PREFIX || ".")}pair 226XXXXXXXX` },
        { quoted: m }
      );
    }

    // ✅ éviter les numéros du genre 00226....
    num = num.replace(/^0+/, "");

    // ✅ si un pairing est déjà en cours pour ce numéro, on stop l'ancien
    const existing = global.__pairSockets.get(num);
    if (existing?.end) {
      try { existing.end(); } catch {}
      global.__pairSockets.delete(num);
    }

    await sock.sendMessage(
      from,
      { text: "⏳ Génération du code WhatsApp (ne quitte pas, le code expire vite)..." },
      { quoted: m }
    );

    const accountsDir = path.join(__dirname, "..", "accounts");
    if (!fs.existsSync(accountsDir)) fs.mkdirSync(accountsDir, { recursive: true });

    // Dossier temporaire de pairing
    const sessionDir = path.join(accountsDir, `pair_${num}`);
    if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
      const { version } = await fetchLatestBaileysVersion();

      const tmpSock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["NOVA XMD V1", "Chrome", "1.0.0"],
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        // ✅ options utiles
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 60_000,
        keepAliveIntervalMs: 10_000,
        markOnlineOnConnect: false,
        syncFullHistory: false
      });

      tmpSock.ev.on("creds.update", saveCreds);

      // ✅ IMPORTANT: on garde le socket vivant
      global.__pairSockets.set(num, tmpSock);

      // quand c’est lié, WhatsApp “open” la session
      tmpSock.ev.on("connection.update", async (u) => {
        const { connection, lastDisconnect } = u;

        if (connection === "open") {
          // ✅ pairing réussi -> on renomme le dossier en session_XXXX
          try {
            const finalDir = path.join(accountsDir, `session_${num}`);

            // supprime ancienne session_ si existe
            if (fs.existsSync(finalDir)) fs.rmSync(finalDir, { recursive: true, force: true });

            fs.renameSync(sessionDir, finalDir);
          } catch {}

          try {
            await sock.sendMessage(from, {
              text: `✅ Pairing terminé !\n📂 Session sauvegardée : session_${num}`,
              contextInfo: newsletterContext()
            }, { quoted: m });
          } catch {}

          // on peut fermer (session est sauvegardée)
          try { tmpSock.end(); } catch {}
          global.__pairSockets.delete(num);
        }

        if (connection === "close") {
          const code = lastDisconnect?.error?.output?.statusCode;
          if (code === DisconnectReason.loggedOut) {
            // normal après close parfois
          }
        }
      });

      // petite attente pour stabilité
      await delay(2500);

      const code = await tmpSock.requestPairingCode(num);

      if (!code) throw new Error("No code returned");

      // ✅ auto-expire: si pas lié en 2 minutes, on ferme
      setTimeout(() => {
        const s = global.__pairSockets.get(num);
        if (s) {
          try { s.end(); } catch {}
          global.__pairSockets.delete(num);
        }
        try { if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
      }, 120000);

      // ✅ envoie code SANS déco
      return sock.sendMessage(
        from,
        {
          text:
`╭━━〔 🤖 *${config.BOT_NAME || "NOVA XMD V1"}* 〕━━╮
┃ ✅ PAIRING CODE GÉNÉRÉ
┃ 📱 Numéro : ${num}
┃ 🔑 Code :
┃ ${code}
┣━━━━━━━━━━━━━━━━━━
┃ ⚠️ Entre le code vite (expire)
┃ ✅ code expire dans 2 minute
╰━━━━━━━━━━━━━━━━━━━━━━╯`,
          contextInfo: newsletterContext()
        },
        { quoted: m }
      );

    } catch (e) {
      // cleanup
      try { global.__pairSockets.delete(num); } catch {}
      try { if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}

      return sock.sendMessage(
        from,
        { text: `❌ Impossible de générer le code.\nRaison: ${e?.message || "Erreur"}` },
        { quoted: m }
      );
    }
  }
};