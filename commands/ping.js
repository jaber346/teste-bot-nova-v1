// ✅ PING FIX (mesure réelle)
if (command === "ping") {
  const from = m.key.remoteJid;

  const start = Date.now();

  // 1) petit message pour créer un vrai délai réseau/traitement
  await sock.sendMessage(from, { text: "⏳ Testing speed..." }, { quoted: m });

  // 2) mesurer après l’envoi
  const latency = Date.now() - start;

  const modeText = (currentMode || "public").toUpperCase();

  return sock.sendMessage(
    from,
    {
      text:
`╭━━〔 🤖 NOVA XMD V1 〕━━╮
┃ 🏓 𝙿𝙸𝙽𝙶
┣━━━━━━━━━━━━━━━━━━
┃ ⚡ Speed : ${latency} ms
┃ 🌐 Mode  : ${modeText}
┃ 🟢 Status: ONLINE
╰━━━━━━━━━━━━━━━━━━╯`
    },
    { quoted: m }
  );
}