require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  EmbedBuilder,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [Partials.Channel],
});

// ---------- Armazenamento simples em arquivo JSON ----------
// Guarda quantos invites cada pessoa já trouxe, mesmo se o bot reiniciar.

const DATA_FILE = path.join(__dirname, 'invites-data.json');

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {}; // { [userId]: totalInvites }
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let inviteCounts = loadData();

// Cache em memória: guildId -> Map(codigoDoInvite -> usos)
const guildInvitesCache = new Map();

async function cacheGuildInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    const codeUses = new Map();
    invites.forEach((invite) => codeUses.set(invite.code, invite.uses ?? 0));

    // Invite de vanity URL (ex: discord.gg/seu-servidor) não aparece em invites.fetch()
    if (guild.vanityURLCode) {
      try {
        const vanity = await guild.fetchVanityData();
        codeUses.set(guild.vanityURLCode, vanity.uses ?? 0);
      } catch {
        // servidor sem boost suficiente ou sem permissão, ignora
      }
    }

    guildInvitesCache.set(guild.id, codeUses);
  } catch (err) {
    console.error(`Não foi possível cachear os invites de ${guild.name}:`, err.message);
  }
}

// ---------- Eventos ----------

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot online como ${c.user.tag}`);

  for (const guild of c.guilds.cache.values()) {
    await cacheGuildInvites(guild);
  }
});

// Atualiza o cache sempre que um invite novo é criado
client.on(Events.InviteCreate, async (invite) => {
  const guildId = invite.guild?.id;
  if (!guildId) return;
  const cache = guildInvitesCache.get(guildId) || new Map();
  cache.set(invite.code, invite.uses ?? 0);
  guildInvitesCache.set(guildId, cache);
});

// Remove do cache quando um invite é deletado
client.on(Events.InviteDelete, async (invite) => {
  const guildId = invite.guild?.id;
  if (!guildId) return;
  const cache = guildInvitesCache.get(guildId);
  if (cache) cache.delete(invite.code);
});

client.on(Events.GuildMemberAdd, async (member) => {
  const guild = member.guild;
  const oldCache = guildInvitesCache.get(guild.id) || new Map();

  let newInvites;
  try {
    newInvites = await guild.invites.fetch();
  } catch (err) {
    console.error('Erro ao buscar invites atuais:', err.message);
    return;
  }

  const newCodeUses = new Map();
  newInvites.forEach((invite) => newCodeUses.set(invite.code, invite.uses ?? 0));

  if (guild.vanityURLCode) {
    try {
      const vanity = await guild.fetchVanityData();
      newCodeUses.set(guild.vanityURLCode, vanity.uses ?? 0);
    } catch {
      // ignora
    }
  }

  // Descobre qual invite teve o número de usos aumentado
  let usedInvite = null;
  for (const [code, uses] of newCodeUses.entries()) {
    const before = oldCache.get(code) ?? 0;
    if (uses > before) {
      usedInvite = newInvites.get(code) || { code, inviter: null };
      break;
    }
  }

  guildInvitesCache.set(guild.id, newCodeUses);

  const channelId = process.env.INVITES_CHANNEL_ID;
  const channel = channelId ? guild.channels.cache.get(channelId) : null;
  if (!channel) return;

  if (!usedInvite || !usedInvite.inviter) {
    // Não deu pra identificar quem convidou (ex: entrou via vanity URL, ou invite expirou/bot sem permissão)
    await channel.send({
      content: `${member} entrou no servidor, mas não foi possível identificar quem convidou.`,
    }).catch(() => {});
    return;
  }

  const inviterId = usedInvite.inviter.id;
  inviteCounts[inviterId] = (inviteCounts[inviterId] || 0) + 1;
  saveData(inviteCounts);

  const total = inviteCounts[inviterId];

  await channel.send({
    content:
      `${member} has been invited by <@${inviterId}> and has now ${total} invite${total === 1 ? '' : 's'}.`,
  }).catch((err) => console.error('Erro ao enviar mensagem de invite:', err.message));
});

// Quando o bot entra em um servidor novo, cacheia os invites dele
client.on(Events.GuildCreate, async (guild) => {
  await cacheGuildInvites(guild);
});

client.login(process.env.DISCORD_TOKEN);
