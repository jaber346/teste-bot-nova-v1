// commands/ch-sticker.js
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { execFile } = require("child_process");
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

const TMP_DIR = path.join(__dirname, "..", "tmp");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

async function downloadToFile(url, outPath) {
  const r = await axios.get(url, { responseType: "arraybuffer", timeout: 60000 });
  fs.writeFileSync(outPath, r.data);
  return outPath;
}

/**
 * Convertit GIF/MP4 -> WEBP animé (sticker WhatsApp)
 * - 512px max
 * - loop 0
 * - fps raisonnable
 */
async function toAnimatedWebp(inputPath, outputPath) {
  // ffmpeg input -> animated webp
  // note: -lossless 0 pour réduire taille, -q:v 50 (qualité)
  const args = [
    "-y",
    "-i", inputPath,
    "-vf", "scale=512:-1:flags=lanczos,fps=15",
    "-loop", "0",
    "-an",
    "-vsync", "0",
    "-preset", "default",
    "-q:v", "50",
    outputPath
  ];
  await run("ffmpeg", args);
  return outputPath;
}

async function tenorSearch(query, limit = 4) {
  const key = ;
  if (!key) throw new Error("TENOR_KEY missing");

  // Tenor v2 search
  const url = "https://tenor.googleapis.com/v2/search";
  const { data } = await axios.get(url, {
    params: {
      q: query,
      key,
      limit,
      media_filter: "gif,mp4,tinygif,tinymp4",
      contentfilter: "high"
    },
    timeout: 30000
  });

  const results = Array.isArray(data?.results) ? data.results : [];
  const medias = [];

  for (const item of results) {
    const mf = item?.media_formats || {};
    // priorité mp4 (souvent plus léger), sinon gif
    const mp4 = mf?.tinymp4?.url || mf?.mp4?.url;
    const gif = mf?.tinygif?.url || mf?.gif?.url;
    const picked = mp4 || gif;
    if (picked) medias.push(picked);
    if (medias.length >= limit) break;
  }

  return medias;
}

module.exports = {
  name: "ch-sticker",
  category: "Sticker",
  description: "Recherche 4 stickers animés par mot-clé (Tenor) : .ch-sticker limul tempest",

  async execute(sock, m, args, { prefix } = {}) {
    const from = m.key.remoteJid;

    const q = (args || []).join(" ").trim();
    if (!q) {
      return sock.sendMessage(
        from,
        { text: `Utilisation : ${prefix || config.PREFIX || "."}ch-sticker limul tempest` },
        { quoted: m }
      );
    }

    await sock.sendMessage(
      from,
      { text: `🔎 Recherche stickers: *${q}* ...`, contextInfo: newsletterCtx() },
      { quoted: m }
    );

    let urls;
    try {
      urls = await tenorSearch(q, 4);
    } catch (e) {
      return sock.sendMessage(
        from,
        { text: "❌ Erreur recherche.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    if (!urls.length) {
      return sock.sendMessage(
        from,
        { text: "❌ Aucun résultat trouvé.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    // traiter 4 stickers
    for (let i = 0; i < Math.min(4, urls.length); i++) {
      const url = urls[i];

      const inExt = url.includes(".mp4") ? "mp4" : "gif";
      const inFile = path.join(TMP_DIR, `chstk_${Date.now()}_${i}.${inExt}`);
      const outFile = path.join(TMP_DIR, `chstk_${Date.now()}_${i}.webp`);

      try {
        await downloadToFile(url, inFile);
        await toAnimatedWebp(inFile, outFile);

        const webp = fs.readFileSync(outFile);

        await sock.sendMessage(
          from,
          {
            sticker: webp,
            contextInfo: newsletterCtx()
          },
          { quoted: m }
        );
      } catch (e) {
        await sock.sendMessage(
          from,
          { text: "❌ Erreur conversion sticker (ffmpeg manquant ?).", contextInfo: newsletterCtx() },
          { quoted: m }
        );
      } finally {
        try { if (fs.existsSync(inFile)) fs.unlinkSync(inFile); } catch {}
        try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch {}
      }
    }
  }
};