const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");
require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");

// 🔐 驗證環境變數是否正確
const { DISCORD_TOKEN, CLIENT_ID, N8N_WEBHOOK_URL } = process.env;
console.log("📦 環境變數加載情況：");
console.log("  DISCORD_TOKEN:", DISCORD_TOKEN ? "[OK]" : "[缺失]");
console.log("  CLIENT_ID:", CLIENT_ID || "[缺失]");
console.log("  N8N_WEBHOOK_URL:", N8N_WEBHOOK_URL || "[缺失]");

if (!DISCORD_TOKEN || !CLIENT_ID || !N8N_WEBHOOK_URL) {
  console.error(
    "❗ .env 環境變數錯誤：請確認設定了 DISCORD_TOKEN、CLIENT_ID 和 N8N_WEBHOOK_URL"
  );
  process.exit(1);
}

// 🌐 建立健康檢查 Server
const app = express();
app.get("/", (_, res) => {
  console.log("🩺 收到健康檢查請求 /");
  res.send("🤖 Bot is running!");
});
app.listen(8080, () => {
  console.log("🌐 健康檢查 API 啟動成功（port 8080）");
});

// 🤖 建立 Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
console.log("⚙️ Discord client 實例已建立");

// 📦 Slash 指令內容
const command = new SlashCommandBuilder()
  .setName("w")
  .setDescription("查詢 Minecraft 玩家資料")
  .addStringOption((option) =>
    option
      .setName("id")
      .setDescription("請輸入 Minecraft 玩家 ID（必填）")
      .setRequired(true)
  );

// 🚀 當 Bot 準備完成時註冊指令
client.once("ready", async () => {
  console.log("🔑 進入 ready 事件處理中...");
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  try {
    console.log("📡 開始註冊 Slash 指令...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: [command.toJSON()],
    });
    console.log("✅ Slash 指令註冊完成！");
    console.log(`🤖 Bot 上線成功，帳號為 ${client.user.tag}`);
  } catch (err) {
    console.error("❌ Slash 指令註冊失敗：", err);
  }
});

// 🎯 指令觸發時處理邏輯
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "w") {
    const id = interaction.options.getString("id");
    const userTag = interaction.user.tag;

    console.log(`📥 收到 /w 指令，由 ${userTag} 查詢 ID: ${id}`);
    await interaction.reply(`🔍 <@&1355201663152951417> 已發送請求：${id}`);

    try {
      console.log(`🌐 正在發送 webhook 請求至 ${N8N_WEBHOOK_URL}`);
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, user: userTag }),
      });

      const data = await response.json();
      console.log(`📡 Webhook HTTP 狀態碼: ${response.status}`);
      console.log(`📨 Webhook 回應資料:`, data);

      if (data.status === "error") {
        await interaction.followUp(`❌ 查無資料：\`${id}\``);
      } else if (data.status === "ok") {
        await interaction.followUp(`✅ 查詢成功：\`${id}\` - ${data.name}`);
      } else {
        console.warn("⚠️ 未預期的 webhook 回應格式：", data);
        await interaction.followUp(
          `⚠️ 無法辨識的回應：${JSON.stringify(data)}`
        );
      }
    } catch (error) {
      console.error("❌ webhook 請求發生錯誤：", error);
      await interaction.followUp("❗ 發送請求時發生錯誤，請稍後再試");
    }
  }
});

// 🔐 登入 Discord（並補強錯誤輸出）
console.log("🚪 開始登入 Discord...");
client.login(DISCORD_TOKEN).catch((err) => {
  console.error("❌ Bot 登入失敗，DISCORD_TOKEN 可能錯誤");
  console.error(err);
  // ⚠️ 建議先不 exit，好觀察 Zeabur log
  // process.exit(1);
});
