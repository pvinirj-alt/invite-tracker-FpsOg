# Invite Tracker

Bot que rastreia quem convidou quem no seu servidor do Discord e envia uma mensagem tipo:

> @fulano has been invited by @ciclano and has now 4 invites.

## Configuração

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env` e preencha:
   - `DISCORD_TOKEN`: token do seu bot (Discord Developer Portal > Bot).
   - `CLIENT_ID`: Application ID do bot.
   - `INVITES_CHANNEL_ID`: ID do canal onde as mensagens de invite serão enviadas.

3. No Developer Portal, na aba **Bot**, ative em "Privileged Gateway Intents":
   - **Server Members Intent**

4. Ao gerar o link de convite (OAuth2 > URL Generator), marque o escopo `bot` e as permissões:
   - View Channels
   - Send Messages
   - Create Instant Invite (recomendado, pra garantir acesso de leitura aos invites)
   - Manage Server **não é necessário**, mas o bot precisa conseguir ver os invites do servidor (qualquer cargo com permissão de ver convites funciona)

5. Rode o bot:
   ```bash
   npm start
   ```

## Como funciona

O bot guarda em memória (e em um arquivo `invites-data.json`, que persiste entre reinicializações) quantos convites cada pessoa já trouxe. Quando alguém entra no servidor, ele compara os convites de antes e depois pra descobrir qual link foi usado, identifica quem criou esse link, e manda a mensagem no canal configurado.

**Limitações conhecidas (do próprio Discord, não dá pra contornar):**
- Convites por **vanity URL** (ex: discord.gg/seunome) não têm um "dono" — o bot avisa que não conseguiu identificar quem convidou.
- Se dois links forem usados quase ao mesmo tempo, pode haver pequena imprecisão (limitação da API do Discord).
