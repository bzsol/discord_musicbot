const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const queue = new Map();

client.once('ready', () => {
    console.log('Bot is online!');
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const serverQueue = queue.get(message.guild.id);

    if (message.content.startsWith('!play')) {
        await execute(message, serverQueue);
    } else if (message.content.startsWith('!skip')) {
        skip(message, serverQueue);
    } else if (message.content.startsWith('!stop')) {
        stop(message, serverQueue);
    }
});

async function execute(message, serverQueue) {
    const args = message.content.split(' ');

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
        return message.channel.send('You need to be in a voice channel to play music!');
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
        return message.channel.send('I need the permissions to join and speak in your voice channel!');
    }

   




    try {
        const songInfo = await ytdl.getInfo(args[1]);
        let audioFormats = ytdl.filterFormats(songInfo.formats, 'audioonly');
        console.log('Formats with only audio: ' + audioFormats);
        const song = {
            title: songInfo.videoDetails.title,
            url: songInfo.videoDetails.video_url,
        };

        if (!serverQueue) {
            const queueContruct = {
                textChannel: message.channel,
                voiceChannel: voiceChannel,
                connection: null,
                player: createAudioPlayer(),
                songs: [],
            };

            queue.set(message.guild.id, queueContruct);

            queueContruct.songs.push(song);

            try {
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });
                queueContruct.connection = connection;
                queueContruct.connection.subscribe(queueContruct.player);

                play(message.guild, queueContruct.songs[0]);
            } catch (err) {
                console.error('Error connecting to voice channel:', err);
                queue.delete(message.guild.id);
                return message.channel.send('Error connecting to the voice channel.');
            }
        } else {
            serverQueue.songs.push(song);
            return message.channel.send(`${song.title} has been added to the queue!`);
        }
    } catch (err) {
        console.error('Error fetching song info:', err);
        message.channel.send('There was an error fetching the song info.');
    }
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send('You have to be in a voice channel to skip the music!');
    if (!serverQueue)
        return message.channel.send('There is no song that I could skip!');
    serverQueue.player.stop();
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send('You have to be in a voice channel to stop the music!');
    if (!serverQueue)
        return message.channel.send('There is no music playing to stop!');
    serverQueue.songs = [];
    serverQueue.player.stop();
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        if (serverQueue.connection && serverQueue.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            serverQueue.connection.destroy();
        }
        queue.delete(guild.id);
        return;
    }

    
    const stream = ytdl(song.url, { filter: 'audioonly', quality: 'highestaudio' });

    const resource = createAudioResource(stream);
    

    serverQueue.player.play(resource);

    serverQueue.player.on('error', error => {
        console.error(`Error occurred during playback: ${error.message}`);
        serverQueue.songs.shift();
        play(guild, serverQueue.songs[0]);
    });

    serverQueue.player.on(AudioPlayerStatus.Idle, () => {
        serverQueue.songs.shift();
        if (serverQueue.songs.length > 0) {
            play(guild, serverQueue.songs[0]);
        } else {
            if (serverQueue.connection && serverQueue.connection.state.status !== VoiceConnectionStatus.Destroyed) {
                serverQueue.connection.destroy();
            }
            queue.delete(guild.id);
        }
    });

    serverQueue.textChannel.send(`Start playing: **${song.title}**`);
}

client.login(process.env.TOKEN);
