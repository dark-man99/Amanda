const rp = require("request-promise");
const Discord = require("discord.js");
const Jimp = require("jimp");
require("../types.js");

/**
 * @param {PassthroughType} passthrough
 */
module.exports = function(passthrough) {
	let { client, config, utils, commands, reloadEvent } = passthrough;

	sendStatsTimeout = setTimeout(sendStatsTimeoutFunction, 1000*60*60 - (Date.now() % (1000*60*60)));
	/**
	 * Sends client statistics to the database in an interval
	 */
	function sendStatsTimeoutFunction() {
		sendStats();
		sendStatsTimeout = setTimeout(sendStatsTimeoutFunction, 1000*60*60);
	}

	reloadEvent.once(__filename, () => {
		clearTimeout(sendStatsTimeout);
	});

	class JIMPStorage {
		constructor() {
			this.store = new Map()
		}
		save(name, type, value) {
			if (type == "file") {
				let promise = Jimp.read(value)
				this.savePromise(name, promise)
			} else if (type == "font") {
				let promise = Jimp.loadFont(value)
				this.savePromise(name, promise)
			}
		}
		savePromise(name, promise) {
			this.store.set(name, promise)
			promise.then(result => {
				this.store.set(name, result)
			})
		}
		get(name) {
			let value = this.store.get(name)
			if (value instanceof Promise) return value
			else return Promise.resolve(value)
		}
		getAll(names) {
			let result = new Map()
			return Promise.all(names.map(name =>
				this.get(name).then(value => result.set(name, value))
			)).then(() => result)
		}
	}

	let profileStorage = new JIMPStorage()
	profileStorage.save("canvas", "file", "./images/defaultbg.png")
	profileStorage.save("profile", "file", "./images/profile.png")
	profileStorage.save("font", "font", ".fonts/Whitney-25.fnt")
	profileStorage.save("font2", "font", ".fonts/profile/Whitney-20-aaa.fnt")
	profileStorage.save("heart-full", "file", "./images/emojis/pixel-heart.png")
	profileStorage.save("heart-broken", "file", "./images/emojis/pixel-heart-broken.png")
	profileStorage.save("badge-developer", "file", "./images/badges/Developer_50x50.png")
	profileStorage.save("badge-donator", "file", "./images/badges/Donator_50x50.png")
	profileStorage.save("badge-none", "file", "./images/36393E.png")

	/**
	 * A function to send stats to the database
	 * @param {Discord.Message} msg A Discord managed message object
	 */
	async function sendStats(msg) {
		console.log("Sending stats...");
		let now = Date.now();
		let myid = client.user.id;
		let ramUsageKB = Math.floor(((process.memoryUsage().rss - (process.memoryUsage().heapTotal - process.memoryUsage().heapUsed)) / 1024))
		let users = client.users.size;
		let guilds = client.guilds.size;
		let channels = client.channels.size;
		let voiceConnections = client.voiceConnections.size;
		let uptime = process.uptime();
		await utils.sql.all("INSERT INTO StatLogs VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [now, myid, ramUsageKB, users, guilds, channels, voiceConnections, uptime]);
		if (msg) msg.react("👌");
		return console.log("Sent stats.", new Date().toUTCString());
	}

	function getHeartType(user, info) {
		// Full hearts for Amanda! Amanda loves everyone.
		if (user.id == client.user.id) return "full";
		// User doesn't love anyone. Sad.
		if (!info.waifu) return "broken";
		// Full heart if user loves Amanda.
		if (info.waifu.id == client.user.id) return "full";
		// User isn't loved by anyone. Oh dear...
		if (!info.claimer) return "broken";
		// If we get here, then the user both loves and is loved back, but not by Amanda.
		// User is loved back by the same person
		if (info.waifu.id == info.claimer.id) return "full";
		// So the user must be loved by someone else.
		return "broken";
	}

	return {
		"statistics": {
			usage: "none",
			description: "Displays detailed statistics",
			aliases: ["statistics", "stats"],
			category: "meta",
			/**
			 * @param {Discord.Message} msg
			 */
			process: async function(msg) {
				let ramUsage = (((process.memoryUsage().rss - (process.memoryUsage().heapTotal - process.memoryUsage().heapUsed)) / 1024) / 1024).toFixed(2);
				let nmsg = await msg.channel.send("Ugh. I hate it when I'm slow, too");
				let embed = new Discord.RichEmbed()
				.addField(client.user.tag+" <:online:453823508200554508>",
					`**❯ Gateway:**\n${client.ping.toFixed(0)}ms\n`+
					`**❯ Latency:**\n${nmsg.createdTimestamp - msg.createdTimestamp}ms\n`+
					`**❯ Uptime:**\n${process.uptime().humanize("sec")}\n`+
					`**❯ RAM Usage:**\n${ramUsage}MB`, true)
				.addField("­",
					`**❯ User Count:**\n${client.users.size} users\n`+
					`**❯ Guild Count:**\n${client.guilds.size} guilds\n`+
					`**❯ Channel Count:**\n${client.channels.size} channels\n`+
					`**❯ Voice Connections:**\n${client.voiceConnections.size}`, true)
				.setColor("36393E")
				return nmsg.edit({embed});
			}
		},

		"ping": {
			usage: "none",
			description: "Gets latency to Discord",
			aliases: ["ping", "pong"],
			category: "meta",
			/**
			 * @param {Discord.Message} msg
			 */
			process: async function (msg) {
				let array = ["So young... So damaged...", "We've all got no where to go...","You think you have time...", "Only answers to those who have known true despair...", "Hopeless...", "Only I know what will come tomorrow...", "So dark... So deep... The secrets that you keep...", "Truth is false...", "Despair..."];
				let message = array.random();
				let nmsg = await msg.channel.send(message);
				let embed = new Discord.RichEmbed().setAuthor("Pong!").addField("❯ Gateway:", `${client.ping.toFixed(0)}ms`, true).addField(`❯ Message Send:`, `${nmsg.createdTimestamp - msg.createdTimestamp}ms`, true).setFooter("W-Wait... It's called table tennis").setColor("36393E")
				return nmsg.edit({embed});
			}
		},

		"forcestatupdate": {
			usage: "none",
			description: "",
			aliases: ["forcestatupdate"],
			category: "admin",
			/**
			 * @param {Discord.Message} msg
			 */
			process: function(msg) {
				sendStats(msg);
			}
		},

		"restartnotify": {
			usage: "none",
			description: "",
			aliases: ["restartnotify"],
			category: "admin",
			/**
			 * @param {Discord.Message} msg
			 */
			process: async function(msg) {
				await utils.sql.all("REPLACE INTO RestartNotify VALUES (?, ?, ?)", [client.user.id, msg.author.id, msg.channel.id]);
				msg.react("✅");
			}
		},

		"invite": {
			usage: "none",
			description: "Sends the bot invite link to you via DMs",
			aliases: ["invite", "inv"],
			category: "meta",
			/**
			 * @param {Discord.Message} msg
			 */
			process: async function(msg) {
				let embed = new Discord.RichEmbed().setDescription("**I've been invited?**\n*Be sure that you have manage server permissions on the server you would like to invite me to*").setTitle("Invite Link").setURL("https://discord-bots.ga/amanda").setColor("36393E")
				try {
					await msg.author.send({embed});
					if (msg.channel.type != "dm") msg.channel.send(`${msg.author.username}, a DM has been sent!`);
					return;
				} catch (reason) { return msg.channel.send(client.lang.dm.failed(msg));}
			}
		},

		"info": {
			usage: "none",
			description: "Displays information about Amanda",
			aliases: ["info", "inf"],
			category: "meta",
			/**
			 * @param {Discord.Message} msg
			 */
			process: async function(msg) {
				let [c1, c2] = await Promise.all([
					client.fetchUser("320067006521147393"),
					client.fetchUser("176580265294954507")
				]);
				let embed = new Discord.RichEmbed()
					.setAuthor("Amanda", client.user.smallAvatarURL)
					.setDescription("Thank you for choosing me as your companion! :heart:\nHere's a little bit of info about me...")
					.addField("Creators",
						`${c1.tag} <:bravery:479939311593324557> <:EarlySupporterBadge:585638218255564800> <:NitroBadge:421774688507920406> <:boostlvl1:582555022014021643>\n`+
						`${c2.tag} <:brilliance:479939329104412672> <:EarlySupporterBadge:585638218255564800> <:NitroBadge:421774688507920406> <:boostlvl1:582555022014021643>`)
					.addField("Code", `[node.js](https://nodejs.org/) ${process.version} + [discord.js](https://www.npmjs.com/package/discord.js) ${Discord.version}`)
					.addField("Links", `Visit Amanda's [website](${config.website_protocol}://${config.website_domain}/) or her [support server](https://discord.gg/zhthQjH)\nWanna donate? Check out her [Patreon](https://www.patreon.com/papiophidian) or make a 1 time donation through [PayPal](https://paypal.me/papiophidian).`)
					.setColor("36393E");
				return msg.channel.send(embed);
			}
		},

		"donate": {
			usage: "none",
			description: "Get information on how to donate",
			aliases: ["donate", "patreon"],
			category: "meta",
			/**
			 * @param {Discord.Message} msg
			 */
			process: function(msg) {
				let embed = new Discord.RichEmbed().setColor("36393E").setTitle("Thinking of donating? :heart:")
				.setDescription("I'm excited that you're possibly interested in supporting my creators. If you're interested in making monthly donations, you may at [Patreon](https://www.patreon.com/papiophidian) or If you're interested in a one time donation, you can donate through [PayPal](https://paypal.me/papiophidian)\n\nAll money donated will go back into development. Access to features will also not change regardless of your choice but you will recieve a donor role if you join my [Support Server](https://discord.gg/zhthQjH) and get a distinguishing donor badge on &profile");
				return msg.channel.send(embed);
			}
		},

		"commits": {
			usage: "none",
			description: "Gets the latest git commits to Amanda",
			aliases: ["commits", "commit", "git"],
			category: "meta",
			/**
			 * @param {Discord.Message} msg
			 */
			process: async function(msg) {
				msg.channel.sendTyping();
				const limit = 5;
				let body = await rp("https://cadence.gq/api/amandacommits?limit="+limit);
				let data = JSON.parse(body);
				return msg.channel.send(new Discord.RichEmbed()
					.setTitle("Git info")
					.addField("Status", "On branch "+data.branch+", latest commit "+data.latestCommitHash)
					.addField(`Commits (latest ${limit} entries)`, data.logString)
					.setColor("36393E")
				);
			}
		},

		"privacy": {
			usage: "none",
			description: "Details Amanda's privacy statement",
			aliases: ["privacy"],
			category: "meta",
			/**
			 * @param {Discord.Message} msg
			 */
			process: async function(msg) {
				let embed = new Discord.RichEmbed().setAuthor("Privacy").setDescription("Amanda may collect basic user information. This data includes but is not limited to usernames, discriminators, profile pictures and user identifiers also known as snowflakes.This information is exchanged solely between services related to the improvement or running of Amanda and [Discord](https://discordapp.com/terms). It is not exchanged with any other providers. That's a promise. If you do not want your information to be used by the bot, remove it from your servers and do not use it").setColor("36393E")
				try {
					await msg.author.send({embed});
					if (msg.channel.type != "dm") msg.channel.send(client.lang.dm.success(msg));
					return;
				} catch (reason) { return msg.channel.send(client.lang.dm.failed(msg)); }
			}
		},

		"user": {
			usage: "<user>",
			description: "Provides information about a user",
			aliases: ["user"],
			category: "meta",
			/**
			 * @param {Discord.Message} msg
			 * @param {String} suffix
			 */
			process: async function(msg, suffix) {
				let user, member;
				if (msg.channel.type == "text") {
					member = await msg.guild.findMember(msg, suffix, true);
					if (member) user = member.user;
				} else user = await client.findUser(msg, suffix, true);
				if (!user) return msg.channel.send(`Couldn't find that user`);
				let embed = new Discord.RichEmbed().setColor("36393E");
				embed.addField("User ID:", user.id);
				let userCreatedTime = user.createdAt.toUTCString();
				embed.addField("Account created at:", userCreatedTime);
				if (member) {
					let guildJoinedTime = member.joinedAt.toUTCString();
					embed.addField(`Joined ${msg.guild.name} at:`, guildJoinedTime);
				}
				let status = user.presenceEmoji;
				let game = "";
				if (user.presence.game && user.presence.game.streaming) {
					game = `Streaming [${user.presence.game.name}](${user.presence.game.url})`;
					if (user.presence.game.details) game += ` <:RichPresence:477313641146744842>\nPlaying ${user.presence.game.details}`;
					status = `<:streaming:454228675227942922>`;
				} else if (user.presence.game) {
					game = user.presencePrefix+" **"+user.presence.game.name+"**";
					if (user.presence.game.details) game += ` <:RichPresence:477313641146744842>\n${user.presence.game.details}`;
					if (user.presence.game.state && user.presence.game.name == "Spotify") game += `\nby ${user.presence.game.state}`;
					else if (user.presence.game.state) game += `\n${user.presence.game.state}`;
				}
				if (user.bot) status = "<:bot:412413027565174787>";
				embed.setThumbnail(user.displayAvatarURL);
				embed.addField("Avatar URL:", `[Click Here](${user.displayAvatarURL})`);
				embed.setTitle(`${user.tag} ${status}`);
				if (game) embed.setDescription(game);
				return msg.channel.send({embed});
			}
		},

		"avatar": {
			usage: "<user>",
			description: "Gets a user's avatar",
			aliases: ["avatar", "pfp"],
			category: "meta",
			/**
			 * @param {Discord.Message} msg
			 * @param {String} suffix
			 */
			process: async function(msg, suffix) {
				let user, member;
				if (msg.channel.type == "text") {
					member = await msg.guild.findMember(msg, suffix, true);
					if (member) user = member.user;
				} else user = await client.findUser(msg, suffix, true);
				if (!user) return msg.channel.send(client.lang.input.invalid(msg, "user"));
				let embed = new Discord.RichEmbed()
					.setImage(user.displayAvatarURL)
					.setColor("36393E");
				return msg.channel.send({embed});
			}
		},

		"wumbo": {
			usage: "<emoji>",
			description: "Makes an emoji bigger",
			aliases: ["wumbo"],
			category: "meta",
			/**
			 * @param {Discord.Message} msg
			 * @param {String} suffix
			 */
			process: function(msg, suffix) {
				if (!suffix) return msg.channel.send(client.lang.input.invalid(msg, "emoji"));
				let emoji = client.parseEmoji(suffix);
				if (emoji == null) return msg.channel.send(client.lang.input.invalid(msg, "emoji"));
				let embed = new Discord.RichEmbed()
					.setImage(emoji.url)
					.setColor("36393E")
				return msg.channel.send({embed});
			}
		},

		"profile": {
			usage: "<user>",
			description: "Get profile information about someone",
			aliases: ["profile"],
			category: "meta",
			/**
			 * @param {Discord.Message} msg
			 * @param {String} suffix
			 */
			process: async function(msg, suffix) {
				let user, member;
				if (msg.channel.type == "text") {
					member = await msg.guild.findMember(msg, suffix, true);
					if (member) user = member.user;
				} else user = await client.findUser(msg, suffix, true);
				if (!user) return msg.channel.send(client.lang.input.invalid(msg, "user"));

				msg.channel.sendTyping()

				let [isOwner, isPremium, money, info, avatar, images] = await Promise.all([
					utils.hasPermission(user, "owner"),
					utils.sql.get("SELECT * FROM Premium WHERE userID =?", user.id),
					utils.coinsManager.get(user.id),
					utils.waifu.get(user.id),
					Jimp.read(user.sizedAvatarURL(128)),
					profileStorage.getAll(["canvas", "profile", "font", "font2", "heart-full", "heart-broken", "badge-developer", "badge-donator", "badge-none"])
				])

				avatar.resize(111, 111);
				
				let heartType = getHeartType(user, info)
				let heart = images.get("heart-"+heartType)
				
				let badge = isOwner ? "badge-developer" : isPremium ? "badge-donator" : "badge-none"
				let badgeImage = images.get(badge).resize(50, 50)

				let canvas = images.get("canvas")
				canvas.composite(avatar, 32, 85);
				canvas.composite(images.get("profile"), 0, 0);
				canvas.composite(badgeImage, 166, 113);


				let font = images.get("font")
				let font2 = images.get("font2")
				canvas.print(font, 508, 72, user.username);
				canvas.print(font2, 508, 104, `#${user.discriminator}`);
				canvas.print(font2, 550, 163, money);
				canvas.composite(heart, 508, 207);
				canvas.print(font2, 550, 213, user.id == client.user.id ? "You <3" : info.waifu?info.waifu.tag:"Nobody, yet");

				let buffer = await canvas.getBufferAsync(Jimp.MIME_PNG);
				image = new Discord.Attachment(buffer, "profile.png");
				return msg.channel.send({files: [image]});
			}
		},

		"settings": {
			usage: "<self|server> <view|settings name> <true or false>",
			description: "Modify settings Amanda will use for yourself or server wide",
			aliases: ["settings"],
			category: "configuration",
			/**
			 * @param {Discord.Message} msg
			 * @param {String} suffix
			 */
			process: async function(msg, suffix) {
				let args = suffix.split(" ");
				if (msg.channel.type == "dm") {
					if (args[0].toLowerCase() == "server") return msg.channel.send(`You cannot modify a server's settings if you don't use the command in a server`);
				}
				if (args[0].toLowerCase() == "self") {
					if (!args[1]) return msg.channel.send(`${msg.author.tag}, you didn't provide any other arguments. If you would like to view your settings, use &settings self view`);
					if (args[1].toLowerCase() == "view") {
						let memsettings = await utils.settings.get(msg.author.id);
						if (!memsettings) return msg.channel.send(`${msg.author.tag}, it looks like you haven't set any settings. Valid setting names are waifuAlert or gamblingAlert.\nwaifuAlert are DM messages when someone claims you or divorces from you.\ngamblingAlert are DM messages when someone gives you Discoins`);
						return msg.channel.send(new Discord.RichEmbed().setColor("36393E").setAuthor(`Settings for ${msg.author.tag}`, msg.author.smallAvatarURL).setDescription(`Waifu Alerts: ${memsettings.waifuAlert != 0} - Messages for waifu related things\nGambling Alerts: ${memsettings.gamblingAlert != 0} - Messages for gambling related things`));
					}
					if (args[1] == "waifuAlert") {
						if (!["true", "false"].includes(args[2])) return msg.channel.send(`That is not a proper value for setting: waifuAlert`);
						await utils.settings.set(msg.author.id, "user", "waifuAlert", args[2]=="true"?1:0);
					} else if (args[1] == "gamblingAlert") {
						if (!["true", "false"].includes(args[2])) return msg.channel.send(`That is not a proper value for setting: gamblingAlert`);
						await utils.settings.set(msg.author.id, "user", "gamblingAlert", args[2]=="true"?1:0);
					} else return msg.channel.send(`${msg.author.tag}, that is not a valid setting name. Valid settings are waifuAlert and gamblingAlert`);
					return msg.channel.send(`${msg.author.tag}, you have successfully modified your ${args[1]} setting to ${args[2]}`);
				} else if (args[0].toLowerCase() == "server") {
					if (!args[1]) return msg.channel.send(`${msg.author.tag}, you didn't provide any other arguments. If you would like to view this server's settings, use &settings server view`);
					if (args[1].toLowerCase() == "view") {
						let guildsettings = await utils.settings.get(msg.guild.id);
						if (!guildsettings) return msg.channel.send(`${msg.author.tag}, it looks this server hasn't set any settings. ${msg.member.hasPermission("MANAGE_GUILD")?"Valid setting names are waifuAlert or gamblingAlert.\nwaifuAlert are DM messages when someone claims someone or divorces from someone.\ngamblingAlert are DM messages when someone gives someone Discoins": ""}`);
						return msg.channel.send(new Discord.RichEmbed().setColor("36393E").setAuthor(`Settings for ${msg.guild.name}`, msg.guild.iconURL).setDescription(`Waifu Alerts: ${guildsettings.waifuAlert != 0} - Messages for waifu related things\nGambling Alerts: ${guildsettings.gamblingAlert != 0} - Messages for gambling related things`));
					}
					if (!msg.member.hasPermission("MANAGE_GUILD")) return msg.channel.send(`${msg.author.tag}, you must have the manage server permission to modify a server's Amanda settings`);
					if (args[1] == "waifuAlert") {
						if (!["true", "false"].includes(args[2])) return msg.channel.send(`That is not a proper value for setting: waifuAlert`);
						await utils.settings.set(msg.guild.id, "guild", "waifuAlert", args[2]=="true"?1:0);
					} else if (args[1] == "gamblingAlert") {
						if (!["true", "false"].includes(args[2])) return msg.channel.send(`That is not a proper value for setting: gamblingAlert`);
						await utils.settings.set(msg.guild.id, "guild", "gamblingAlert", args[2]=="true"?1:0);
					} else return msg.channel.send(`${msg.author.tag}, that is not a valid setting name. Valid settings are waifuAlert and gamblingAlert`);
					return msg.channel.send(`${msg.author.tag}, you have successfully modified ${msg.guild.name}'s ${args[1]} setting to ${args[2]}`);
				} else return msg.channel.send(`${msg.author.username}, that is not a valid operant. Valid operants are self and server`);
			}
		},

		"help": {
			usage: "<command>",
			description: "Your average help command",
			aliases: ["help", "h", "commands", "cmds"],
			category: "meta",
			/**
			 * @param {Discord.Message} msg
			 * @param {String} suffix
			 */
			process: async function (msg, suffix) {
				let embed;
				if (suffix) {
					suffix = suffix.toLowerCase();
					if (suffix == "music" || suffix == "m") {
						embed = new Discord.RichEmbed()
						.setAuthor("&music: command help (aliases: music, m)")
						.addField(`play`, `Play a song or add it to the end of the queue. Use any YouTube video or playlist url or video name as an argument.\n\`&music play https://youtube.com/watch?v=e53GDo-wnSs\` or\n\`&music play despacito\``)
						.addField(`insert`, `Works the same as play, but inserts the song at the start of the queue instead of at the end.\n\`&music insert https://youtube.com/watch?v=e53GDo-wnSs\``)
						.addField(`now`, `Show the current song.\n\`&music now\``)
						.addField(`pause`, `Pause playback.\n\`&music pause\``)
						.addField(`resume`, `Resume playback. (Unpause.)\n\`&music resume\``)
						.addField(`related [play|insert] [index]`,
							"Show videos related to what's currently playing. Specify either `play` or `insert` and an index number to queue that song.\n"+
							"`&music related` (shows related songs)\n"+
							"`&music rel play 8` (adds related song #8 to the end of the queue)")
						.addField("auto", "Enable or disable auto mode.\n"+
							"When auto mode is enabled, when the end of the queue is reached, the top recommended song will be queued automatically, and so music will play endlessly.\n"+
							"`&music auto`")
						.addField(`queue`, `Shows the current queue.\n\`&music queue\``)
						.addField(`shuffle`, `Shuffle the queue. Does not affect the current song.\n\`&music shuffle\``)
						.addField(`skip`, `Skip the current song and move to the next item in the queue.\n\`&music skip\``)
						.addField(`stop`, `Empty the queue and leave the voice channel.\n\`&music stop\``)
						.addField(`playlist`, `Manage playlists. Try \`&help playlist\` for more info.`)
						.setColor('36393E')
						send("dm");
					} else if (suffix.includes("playlist")) {
						embed = new Discord.RichEmbed()
						.setAuthor(`&music playlist: command help (aliases: playlist, playlists, pl)`)
						.setDescription("All playlist commands begin with `&music playlist` followed by the name of a playlist. "+
							"If the playlist name does not exist, you will be asked if you would like to create a new playlist with that name.\n"+
							"Note that using `add`, `remove`, `move`, `import` and `delete` require you to be the owner (creator) of a playlist.")
						.addField("show", "Show a list of all playlists.\n`&music playlist show`")
						.addField("(just a playlist name)", "List all songs in a playlist.\n`&music playlist xi`")
						.addField("play [start] [end]", "Play a playlist.\n"+
							"Optionally, specify values for start and end to play specific songs from a playlist. "+
							"Start and end are item index numbers, but you can also use `-` to specify all songs towards the list boundary.\n"+
							"`&music playlist xi play` (plays the entire playlist named `xi`)\n"+
							"`&music playlist xi play 32` (plays item #32 from the playlist)\n"+
							"`&music playlist xi play 3 6` (plays items #3, #4, #5 and #6 from the playlist)\n"+
							"`&music playlist xi play 20 -` (plays all items from #20 to the end of the playlist)")
						.addField("shuffle [start] [end]", "Play the songs from a playlist, but shuffle them into a random order before queuing them. Works exactly like `play`.\n`&music playlist xi shuffle`")
						.addField("add <url>", "Add a song to a playlist. Specify a URL the same as `&music play`.\n"+
							"`&music playlist xi add https://youtube.com/watch?v=e53GDo-wnSs`")
						.addField("remove <index>", "Remove a song from a playlist.\n"+
							"`index` is the index of the item to be removed.\n"+
							"`&music playlist xi remove 12`")
						.addField("move <index1> <index2>", "Move items around within a playlist. "+
							"`index1` is the index of the item to be moved, `index2` is the index of the position it should be moved to.\n"+
							"The indexes themselves will not be swapped with each other. Instead, all items in between will be shifted up or down to make room. "+
							"If you don't understand what this means, try it out yourself.\n"+
							"`&music playlist xi move 12 13`")
						.addField("find", "Find specific items in a playlist.\n"+
							"Provide some text to search for, and matching songs will be shown.\n"+
							"`&music playlist undertale find hopes and dreams`")
						.addField("import <url>", "Import a playlist from YouTube into Amanda. `url` is a YouTube playlist URL.\n"+
							"`&music playlist undertale import https://www.youtube.com/playlist?list=PLpJl5XaLHtLX-pDk4kctGxtF4nq6BIyjg`")
						.addField("delete", "Delete a playlist. You'll be asked for confirmation.\n`&music playlist xi delete`")
						.setColor('36393E')
						send("dm");
					} else {
						let command = Object.values(commands).find(c => c.aliases.includes(suffix));
						if (command) {
							embed = new Discord.RichEmbed()
							.addField(`Help for ${command.aliases[0]}`,
								`Arguments: ${command.usage}\n`+
								`Description: ${command.description}\n`+
								"Aliases: "+command.aliases.map(a => "`"+a+"`").join(", ")+"\n"+
								`Category: ${command.category}`)
							.setColor('36393E');
							send("channel");
						} else {
							let categoryCommands = Object.values(commands).filter(c => c.category == suffix);
							let maxLength = categoryCommands.map(c => c.aliases[0].length).sort((a, b) => (b - a))[0];
							if (categoryCommands.length) {
								embed = new Discord.RichEmbed()
								.setTitle("Command category: "+suffix)
								.setDescription(
									categoryCommands.map(c =>
										"`"+c.aliases[0]+" ​".repeat(maxLength-c.aliases[0].length)+"` "+c.description // space + zwsp
									).join("\n")+
									"\n\nType `&help <command>` to see more information about a command.\nClick the reaction for a mobile-compatible view.")
								.setColor("36393E")
								send("dm").then(dm => {
									let mobileEmbed = new Discord.RichEmbed()
									.setTitle("Command category: "+suffix)
									.setDescription(categoryCommands.map(c => `**${c.aliases[0]}**\n${c.description}`).join("\n\n"))
									.setColor("36393E")
									let menu = dm.reactionMenu([{emoji: "📱", ignore: "total", actionType: "edit", actionData: mobileEmbed}]);
									setTimeout(() => menu.destroy(true), 5*60*1000);
								});
							} else {
								embed = new Discord.RichEmbed().setDescription(`**${msg.author.tag}**, I couldn't find the help panel for that command`).setColor("B60000");
								send("channel");
							}
						}
					}
				} else {
					let all = Object.values(commands).map(c => c.category);
					let filter = (value, index, self) => { return self.indexOf(value) == index && value != "admin"; };
					let cats = all.filter(filter).sort();
					embed = new Discord.RichEmbed()
					.setAuthor("Command Categories")
					.setDescription(
						`❯ ${cats.join("\n❯ ")}\n\n`+
						"Type `&help <category>` to see all commands in that category.\n"+
						"Type `&help <command>` to see more information about a command.")
					.setColor('36393E');
					send("dm");
				}
				function send(where) {
					return new Promise((resolve, reject) => {
						let target = where == "dm" ? msg.author : msg.channel;
						target.send({embed}).then(dm => {
							if (where == "dm" && msg.channel.type != "dm") msg.channel.send(client.lang.dm.success(msg));
							resolve(dm);
						}).catch(() => {
							msg.channel.send(client.lang.dm.failed(msg));
							reject();
						});
					});
				}
			}
		}
	}
}
