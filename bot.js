const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");
require("dotenv").config();

// ⚠️ 如果你用 Node.js v20+ 可以用內建 fetch，否則保留這行
const fetch = require("node-fetch");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const command = new SlashCommandBuilder()
  .setName("w")
  .setDescription("查詢 Minecraft 玩家資料")
  .addStringOption((option) =>
    option
      .setName("id")
      .setDescription("請輸入 Minecraft 玩家 ID（必填）")
      .setRequired(true)
  );

client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
    body: [command.toJSON()],
  });
  console.log("✅ Slash 指令已註冊成功！");
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "w") {
    const id = interaction.options.getString("id");
    const userTag = interaction.user.tag;

    console.log(`🔔 收到查詢請求 ID: ${id}，由 ${userTag}`);

    await interaction.reply(`🔍 <@&1355201663152951417> 已發送請求：${id}`);

    try {
      const response = await fetch(process.env.N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, user: userTag }),
      });

      const responseData = await response.json();

      console.log(`📡 Webhook 發送狀態: ${response.status}`);
      console.log(`📨 Webhook 回應內容:`, responseData);

      if (responseData.status === "error") {
        await interaction.followUp(`❌ 查無資料：\`${id}\``);
      } else if (responseData.status === "ok") {
        // 你可以自訂顯示欄位，例如回傳名字、編號等
        await interaction.followUp(
          `✅ 查詢成功：\`${id}\` - ${responseData.name}`
        );
      }
    } catch (error) {
      console.error("❌ 發送 webhook 時發生錯誤:", error);
      await interaction.followUp("❗ 發送請求時發生錯誤，請稍後再試");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
