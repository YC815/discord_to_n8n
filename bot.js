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

// 🔐 環境變數檢查
const {
  DISCORD_TOKEN,
  CLIENT_ID,
  N8N_WEBHOOK_URL,
  ADMIN_CHANNEL_ID,
  MEMBER_ROLE_NAME,
} = process.env;

console.log("📦 環境變數加載情況：");
console.log("  DISCORD_TOKEN:", DISCORD_TOKEN ? "[OK]" : "[缺失]");
console.log("  CLIENT_ID:", CLIENT_ID || "[缺失]");
console.log("  N8N_WEBHOOK_URL:", N8N_WEBHOOK_URL || "[缺失]");
console.log("  ADMIN_CHANNEL_ID:", ADMIN_CHANNEL_ID || "[缺失]");
console.log("  MEMBER_ROLE_NAME:", MEMBER_ROLE_NAME || "[缺失]");

if (!DISCORD_TOKEN || !CLIENT_ID || !N8N_WEBHOOK_URL) {
  console.error("❗ 請確認已設定所有環境變數");
  process.exit(1);
}

// 🌐 健康檢查 server
const app = express();
app.get("/", (_, res) => res.send("🤖 Bot is running!"));
app.listen(8080, () => {
  console.log("🌐 健康檢查 API 啟動成功（port 8080）");
});

// 🤖 建立 Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
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

// 🚀 註冊 Slash 指令
client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: [command.toJSON()],
    });
    console.log(`✅ Bot 上線成功：${client.user.tag}`);
  } catch (err) {
    console.error("❌ Slash 指令註冊失敗：", err);
  }
});

// 🎯 處理 Slash 指令
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "w") {
    const id = interaction.options.getString("id");
    const userTag = interaction.user.tag;
    await interaction.reply(`🔍 <@&1355201663152951417> 已發送請求：${id}`);

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, user: userTag }),
      });
      const data = await response.json();

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
      console.error("❌ webhook 發送失敗：", error);
      await interaction.followUp("❗ 發送請求時發生錯誤，請稍後再試");
    }
  }
});

// 🧠 管理員頻道訊息監聽：whitelist add <id>
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== ADMIN_CHANNEL_ID) return;

  const match = message.content.match(/^whitelist add (\w+)$/i);
  if (!match) return;

  const mcId = match[1];
  message.react("✅");
  console.log(`🕵️ 偵測到 whitelist add 指令：${mcId}`);

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: mcId }),
    });
    const data = await response.json();

    if (!data || !data.discordId) {
      console.warn("❌ 無法從 webhook 拿到 Discord ID");
      return message.reply(`⚠️ 找不到 ${mcId} 對應的 Discord 使用者`);
    }

    const member = await message.guild.members.fetch(data.discordId);
    const role = message.guild.roles.cache.find(
      (r) => r.name === MEMBER_ROLE_NAME
    );

    if (!member || !role) {
      return message.reply("❌ 找不到成員或身分組");
    }

    await member.roles.add(role);
    await message.reply(
      `✅ 已將 <@${data.discordId}> 加入 ${MEMBER_ROLE_NAME}`
    );
  } catch (err) {
    console.error("❌ 加身份組時錯誤：", err);
    message.reply("❌ 加身份組失敗，請檢查 webhook 或 Discord 權限");
  }
});

// 🔐 登入 Discord
client.login(DISCORD_TOKEN).catch((err) => {
  console.error("❌ Bot 登入失敗：", err);
});

// 🛡 捕捉未處理錯誤
process.on("unhandledRejection", (reason) => {
  console.error("🛑 Promise 錯誤：", reason);
});
process.on("uncaughtException", (err) => {
  console.error("🧨 例外錯誤：", err);
});
