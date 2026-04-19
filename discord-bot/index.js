const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const ALLOWED_USER_IDS = process.env.ALLOWED_USER_IDS ? process.env.ALLOWED_USER_IDS.split(',').map(id => id.trim()) : [];
const ALLOWED_CHANNEL_IDS = process.env.ALLOWED_CHANNEL_IDS ? process.env.ALLOWED_CHANNEL_IDS.split(',').map(id => id.trim()) : [];
const CLAUDE_PATH = process.env.CLAUDE_PATH || '/home/wasd222/.local/bin/claude';
const COMMAND_PREFIX = process.env.COMMAND_PREFIX || '!c';
const RESPONSE_TIMEOUT = parseInt(process.env.RESPONSE_TIMEOUT || '30000');
const DISCORD_MESSAGE_LIMIT = 2000;

// 권한 체크
function isUserAllowed(userId) {
  if (ALLOWED_USER_IDS.length === 0) return true; // 화이트리스트 비어있으면 모두 허용
  return ALLOWED_USER_IDS.includes(userId);
}

function isChannelAllowed(channelId, isDM) {
  if (ALLOWED_CHANNEL_IDS.length === 0) return true; // 화이트리스트 비어있으면 모두 허용
  return isDM || ALLOWED_CHANNEL_IDS.includes(channelId);
}

// Claude CLI 실행
function executeClaudeCommand(prompt) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      process.kill(process.pid, 'SIGTERM');
      reject(new Error(`Claude 실행 타임아웃 (${RESPONSE_TIMEOUT}ms 초과)`));
    }, RESPONSE_TIMEOUT);

    try {
      // claude --print -p "<prompt>" 로 비대화형 실행
      const claudeProcess = spawn(CLAUDE_PATH, ['--print', '-p', prompt], {
        timeout: RESPONSE_TIMEOUT,
        maxBuffer: 10 * 1024 * 1024, // 10MB 버퍼
      });

      claudeProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      claudeProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      claudeProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Claude 실행 오류: ${error.message}`));
      });

      claudeProcess.on('close', (code) => {
        clearTimeout(timeout);

        if (timedOut) return; // 이미 타임아웃 처리됨

        if (code !== 0) {
          reject(new Error(`Claude 종료 코드: ${code}\n${stderr}`));
        } else {
          resolve(stdout.trim());
        }
      });
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

// 메시지를 Discord 한도에 맞게 분할 (2000자 제한)
function splitMessage(message) {
  const chunks = [];
  let currentChunk = '';

  const lines = message.split('\n');
  for (const line of lines) {
    if ((currentChunk + line + '\n').length > DISCORD_MESSAGE_LIMIT) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      // 라인 자체가 DISCORD_MESSAGE_LIMIT보다 크면 분할
      if (line.length > DISCORD_MESSAGE_LIMIT) {
        chunks.push(line.substring(0, DISCORD_MESSAGE_LIMIT));
        chunks.push(line.substring(DISCORD_MESSAGE_LIMIT));
      } else {
        currentChunk = line + '\n';
      }
    } else {
      currentChunk += line + '\n';
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [message];
}

client.on('ready', () => {
  console.log(`[✅] Bot 로그인됨: ${client.user.tag}`);
  client.user.setActivity(`!c 명령 대기 중...`, { type: 'WATCHING' });
});

client.on('messageCreate', async (message) => {
  try {
    // 봇 자신의 메시지 무시
    if (message.author.id === client.user.id) return;

    const isDM = message.channel.type === ChannelType.DM;
    const isCommand = message.content.startsWith(COMMAND_PREFIX);
    const isDirectMention = message.mentions.has(client.user.id);

    // 명령 파싱
    let prompt = null;
    if (isDM) {
      // DM은 모두 명령
      prompt = message.content.trim();
    } else if (isCommand) {
      // prefix로 시작하는 메시지
      prompt = message.content.substring(COMMAND_PREFIX.length).trim();
    } else if (isDirectMention) {
      // Bot @mention
      prompt = message.content.replace(`<@${client.user.id}>`, '').trim();
    }

    // 명령이 아니면 무시
    if (!prompt) return;

    // 권한 검사
    if (!isUserAllowed(message.author.id)) {
      await message.reply({
        content: `❌ 권한이 없습니다. 이 Bot을 사용할 수 없습니다.`,
        allowedMentions: { repliedUser: false },
      });
      console.log(`[🚫] 허용되지 않은 유저 ${message.author.tag} (${message.author.id})`);
      return;
    }

    if (!isChannelAllowed(message.channelId, isDM)) {
      await message.reply({
        content: `❌ 이 채널에서는 Bot을 사용할 수 없습니다.`,
        allowedMentions: { repliedUser: false },
      });
      console.log(`[🚫] 허용되지 않은 채널 ${message.channelId}`);
      return;
    }

    // 명령 로깅
    console.log(`[📩] ${message.author.tag} (${isDM ? 'DM' : message.guild.name}): ${prompt}`);

    // 타이핑 인디케이터 표시
    await message.channel.sendTyping();

    // Claude 실행
    console.log(`[⏳] Claude 실행 중...`);
    const response = await executeClaudeCommand(prompt);

    if (!response) {
      await message.reply({
        content: '❌ Claude가 응답을 반환하지 않았습니다.',
        allowedMentions: { repliedUser: false },
      });
      return;
    }

    // 응답이 2000자를 초과하면 분할 전송
    const chunks = splitMessage(response);

    for (let i = 0; i < chunks.length; i++) {
      try {
        await message.reply({
          content: chunks[i],
          allowedMentions: { repliedUser: false },
        });

        // Discord API 레이트 리밋 회피
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`[❌] 메시지 전송 실패 (청크 ${i + 1}/${chunks.length}):`, error.message);
      }
    }

    console.log(`[✅] 응답 전송 완료 (${chunks.length}개 청크)`);
  } catch (error) {
    console.error(`[❌] 오류:`, error.message);

    try {
      await message.reply({
        content: `❌ 오류가 발생했습니다:\n\`\`\`\n${error.message.substring(0, 1900)}\n\`\`\``,
        allowedMentions: { repliedUser: false },
      });
    } catch (replyError) {
      console.error(`[❌] 오류 응답 전송 실패:`, replyError.message);
    }
  }
});

// 로그인
console.log('[🔄] Bot 시작 중...');
client.login(DISCORD_TOKEN).catch(error => {
  console.error('[❌] 로그인 실패:', error.message);
  process.exit(1);
});
