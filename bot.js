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
if (!DISCORD_TOKEN || !CLIENT_ID || !N8N_WEBHOOK_URL) {
  console.error(
    "❗ 請確認 .env 中有設定 DISCORD_TOKEN、CLIENT_ID 和 N8N_WEBHOOK_URL"
  );
  process.exit(1);
}

// 🌐 建立健康檢查 Server（避免 Zeabur 停掉 bot）
const app = express();
app.get("/", (_, res) => res.send("🤖 Bot is running!"));
app.listen(8080, () => console.log("🌐 健康檢查 API 監聽中（port 8080）"));

// 🤖 建立 Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// 📦 建立 Slash 指令
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
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: [command.toJSON()],
    });
    console.log("✅ Slash 指令已註冊成功！");
    console.log(`🤖 Bot 已登入：${client.user.tag}`);
  } catch (err) {
    console.error("❌ 註冊 Slash 指令失敗：", err);
  }
});

// 🎯 指令觸發時處理邏輯
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "w") {
    const id = interaction.options.getString("id");
    const userTag = interaction.user.tag;

    console.log(`🔔 收到查詢請求 ID: ${id}，由 ${userTag}`);
    await interaction.reply(`🔍 <@&1355201663152951417> 已發送請求：${id}`);

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, user: userTag }),
      });

      const data = await response.json();
      console.log(`📡 Webhook 狀態碼: ${response.status}`);
      console.log(`📨 Webhook 回應:`, data);

      if (data.status === "error") {
        await interaction.followUp(`❌ 查無資料：\`${id}\``);
      } else if (data.status === "ok") {
        await interaction.followUp(`✅ 查詢成功：\`${id}\` - ${data.name}`);
      } else {
        await interaction.followUp(
          `⚠️ 無法辨識的回應：${JSON.stringify(data)}`
        );
      }
    } catch (error) {
      console.error("❌ webhook 請求錯誤:", error);
      await interaction.followUp("❗ 發送請求時發生錯誤，請稍後再試");
    }
  }
});

// 🔐 登入 Discord（加上錯誤處理）
client.login(DISCORD_TOKEN).catch((err) => {
  console.error("❌ Bot 登入失敗！請確認 DISCORD_TOKEN 是否正確");
  console.error(err);
  process.exit(1);
});
