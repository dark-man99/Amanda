// @ts-check

/** @type {import("jimp").default} */
// @ts-ignore
const Jimp = require("jimp")
const crypto = require("crypto")
const rp = require("request-promise")
const Discord = require("discord.js")

const emojis = require("../modules/emojis")

const passthrough = require("../passthrough")
const { constants, client, commands, reloader } = passthrough

const responses = ["That's not strange at all...", "W-What? Why?", "I find it strange that you tried to do that...", "Ok then...", "Come on... Don't make yourself look like an idiot...", "Why even try?", "Oh...", "You are so weird...", "<:NotLikeCat:411364955493761044>"]

const utils = require("../modules/utilities.js")
reloader.useSync("./modules/utilities.js", utils)

/**
 * @type {Object.<string, import("../modules/managers/datastores/CommandStore").Command>}
 */
const cmds = {
	"ship": {
		usage: "<user 1> <user 2>",
		description: "Ships two people",
		aliases: ["ship"],
		category: "interaction",
		process: async function(msg, suffix, lang) {
			if (msg.channel instanceof Discord.DMChannel) return msg.channel.send(utils.replace(lang.interaction.ship.prompts.guildOnly, { "username": msg.author.username }))
			const permissions = msg.channel.permissionsFor(client.user)
			if (permissions && !permissions.has("ATTACH_FILES")) return msg.channel.send(lang.interaction.ship.prompts.permissionDenied)
			suffix = suffix.replace(/ +/g, " ")
			const args = suffix.split(" ")
			if (args.length != 2) return msg.channel.send(utils.replace(lang.interaction.ship.prompts.invalidUsers, { "username": msg.author.username }))
			const [mem1, mem2] = await Promise.all([
				msg.guild.findMember(msg, args[0]),
				msg.guild.findMember(msg, args[1])
			])
			if (mem1 == null) return msg.channel.send(utils.replace(lang.interaction.ship.prompts.invalidUser1, { "username": msg.author.username }))
			if (mem2 == null) return msg.channel.send(utils.replace(lang.interaction.ship.prompts.invalidUser2, { "username": msg.author.username }))
			if (mem1.id == mem2.id) return msg.channel.send(utils.replace(lang.interaction.ship.prompts.selfShip, { "username": msg.author.username }))
			msg.channel.sendTyping()
			const canvas = new Jimp(300, 100)
			const [pfp1, pfp2, heart] = await Promise.all([
				Jimp.read(mem1.user.displayAvatarURL({ format: "png" })),
				Jimp.read(mem2.user.displayAvatarURL({ format: "png" })),
				Jimp.read("./images/emojis/heart.png")
			])

			pfp1.resize(100, 100)
			pfp2.resize(100, 100)
			heart.resize(80, 80)

			canvas.composite(pfp1, 0, 0)
			canvas.composite(heart, 110, 10)
			canvas.composite(pfp2, 200, 0)

			const buffer = await canvas.getBufferAsync(Jimp.MIME_PNG)
			const image = new Discord.MessageAttachment(buffer, `ship_${mem1.user.username}_${mem2.user.username}`.replace(/[^a-zA-Z0-9_-]+/g, "") + ".png")
			const strings = [mem1.id, mem2.id].sort((a, b) => Number(a) - Number(b)).join(" ")
			let percentage = undefined

			/* Custom Percentages */
			if (strings == "320067006521147393 405208699313848330") percentage = 100
			else if (strings == "158750488563679232 185938944460980224") percentage = 99999999999
			else if (strings == "439373663905513473 458823707175944194") percentage = 88888
			else if (strings == "270993297114267649 320067006521147393") percentage = 100
			else if (strings == "312450203678539787 501820319481200650") percentage = 9999
			else {
				const hash = crypto.createHash("sha256").update(strings).digest("hex").slice(0, 6)
				percentage = Number(`0x${hash}`) % 101
			}
			return msg.channel.send(utils.replace(lang.interaction.ship.returns.rating, { "display1": mem1.displayTag, "display2": mem2.displayTag, "percentage": percentage }), { files: [image] })
		}
	},
	"waifu": {
		usage: "[user]",
		description: "Gets the waifu information about yourself or a user",
		aliases: ["waifu"],
		category: "interaction",
		process: async function(msg, suffix, lang) {
			if (msg.channel instanceof Discord.DMChannel) return msg.channel.send(utils.replace(lang.interaction.waifu.prompts.guildOnly, { "username": msg.author.username }))
			const member = await msg.guild.findMember(msg, suffix, true)
			if (!member) return msg.channel.send(utils.replace(lang.interaction.waifu.prompts.invalidUser, { "username": msg.author.username }))
			const info = await utils.waifu.get(member.id)
			const embed = new Discord.MessageEmbed()
				.setAuthor(member.displayTag, member.user.avatarURL({ format: "png", size: 32 }))
				.addField("Price:", info.price)
				.addField("Claimed by:", info.claimer ? info.claimer.tag : "(nobody)")
				.addField("Waifu:", info.waifu ? info.waifu.tag : "(nobody)")
				.addField("Gifts:", info.gifts.received.emojis || "(none)")
				.setColor("36393E")
			return msg.channel.send(utils.contentify(msg.channel, embed))
		}
	},
	"claim": {
		usage: "<amount: number|all|half> <user>",
		description: "Claims someone as a waifu. Requires Discoins",
		aliases: ["claim"],
		category: "interaction",
		process: async function(msg, suffix, lang) {
			if (msg.channel instanceof Discord.DMChannel) return msg.channel.send(utils.replace(lang.interaction.claim.prompts.guildOnly, { "username": msg.author.username }))
			const args = suffix.split(" ")
			const usertxt = args.slice(1).join(" ")
			if (!args[0]) return msg.channel.send(utils.replace(lang.interaction.claim.prompts.badFormat, { "username": msg.author.username }))
			if (!usertxt) return msg.channel.send(utils.replace(lang.interaction.claim.prompts.invalidUser, { "username": msg.author.username }))
			const member = await msg.guild.findMember(msg, usertxt)
			if (!member) return msg.channel.send(utils.replace(lang.interaction.claim.prompts.invalidUser, { "username": msg.author.username }))
			if (member.id == msg.author.id) return msg.channel.send(utils.replace(lang.interaction.claim.prompts.selfClaim, { "username": msg.author.username }))
			const [memberInfo, money, memsettings, guildsettings] = await Promise.all([
				utils.waifu.get(member.user.id),
				utils.coinsManager.get(msg.author.id),
				utils.sql.get("SELECT * FROM SettingsSelf WHERE keyID =? AND setting =?", [member.id, "waifualert"]),
				utils.sql.get("SELECT * FROM SettingsGuild WHERE keyID =? AND setting =?", [msg.guild.id, "waifualert"])
			])
			let claim = 0
			if (args[0] == "all" || args[0] == "half") {
				if (!money) return msg.channel.send(utils.replace(lang.interaction.claim.prompts.moneyInsufficient, { "username": msg.author.username }))
				if (args[0] == "all") {
					claim = money
				} else {
					claim = Math.floor(money / 2)
				}
			} else {
				claim = Math.floor(Number(args[0]))
				if (isNaN(claim)) return msg.channel.send(utils.replace(lang.interaction.claim.prompts.moneyInsufficient, { "username": msg.author.username }))
				if (claim < 1) return msg.channel.send(utils.replace(lang.interaction.claim.prompts.claimSmall, { "username": msg.author.username }))
				if (claim > money) return msg.channel.send(utils.replace(lang.interaction.claim.prompts.moneyInsufficient, { "username": msg.author.username }))
			}
			if (memberInfo.price >= claim) return msg.channel.send(utils.replace(lang.interaction.claim.prompts.claimedByOther, { "username": msg.author.username, "number": memberInfo.price + 1 }))
			if (memberInfo.claimer && memberInfo.claimer.id == msg.author.id) return msg.channel.send(utils.replace(lang.interaction.claim.prompts.doubleClaim, { "username": msg.author.username }))
			await utils.waifu.bind(msg.author.id, member.id, claim)
			const faces = ["°˖✧◝(⁰▿⁰)◜✧˖°", "(⋈◍＞◡＜◍)。✧♡", "♡〜٩( ╹▿╹ )۶〜♡", "( ´͈ ॢꇴ `͈ॢ)･*♡", "❤⃛῍̻̩✧(´͈ ૢᐜ `͈ૢ)"]
			const face = utils.arrayRandom(faces)
			const memlang = await utils.getLang(member.id, "self")
			const embed = new Discord.MessageEmbed()
				.setDescription(utils.replace(lang.interaction.claim.returns.claimed, { "mention1": String(msg.author), "mention2": String(member), "number": claim }))
				.setColor("36393E")
			msg.channel.send(utils.contentify(msg.channel, embed))
			if (memsettings && memsettings.value == 0) return
			if (guildsettings && guildsettings.value == 0) {
				if (memsettings && memsettings.value == 1) return member.send(`${utils.replace(memlang.interaction.claim.returns.dm, { "mention": String(msg.author), "number": claim })} ${face}`).catch(() => msg.channel.send(lang.interaction.claim.prompts.dmFailed))
				else return
			}
			return member.send(`${utils.replace(memlang.interaction.claim.returns.dm, { "mention": String(msg.author), "number": claim })} ${face}`).catch(() => msg.channel.send(lang.interaction.claim.prompts.dmFailed))
		}
	},
	"divorce": {
		usage: "[reason]",
		description: "Divorces a user",
		aliases: ["divorce"],
		category: "interaction",
		process: async function(msg, suffix, lang) {
			const info = await utils.waifu.get(msg.author.id)
			if (!info.waifu) return msg.channel.send(utils.replace(lang.interaction.divorce.prompts.noWaifu, { "username": msg.author.username }))
			const faces = ["( ≧Д≦)", "●︿●", "(  ❛︵❛.)", "╥﹏╥", "(っ◞‸◟c)"]
			const face = utils.arrayRandom(faces)
			await utils.waifu.unbind(msg.author.id)
			msg.channel.send(utils.replace(lang.interaction.divorce.returns.divorced, { "tag1": msg.author.tag, "tag2": info.waifu.tag, "reason": suffix ? `reason: ${suffix}` : "no reason specified" }))
			const memsettings = await utils.sql.get("SELECT * FROM SettingsSelf WHERE keyID =? AND setting =?", [info.waifu.id, "waifualert"])
			let guildsettings
			const memlang = await utils.getLang(info.waifu.id, "self")
			if (msg.guild) guildsettings = await utils.sql.get("SELECT * FROM SettingsGuild WHERE keyID =? AND setting =?", [msg.guild.id, "waifualert"])
			if (memsettings && memsettings.value == 0) return
			if (guildsettings && guildsettings.value == 0) {
				if (memsettings && memsettings.value == 1) return info.waifu.send(`${utils.replace(memlang.interaction.divorce.returns.dm, { "tag": msg.author.tag, "reason": suffix ? `reason: ${suffix}` : "no reason specified" })} ${face}`).catch(() => msg.channel.send(lang.interaction.divorce.prompts.dmFailed))
				else return
			}
			return info.waifu.send(`${utils.replace(memlang.interaction.divorce.returns.dm, { "tag": msg.author.tag, "reason": suffix ? `reason: ${suffix}` : "no reason specified" })} ${face}`).catch(() => msg.channel.send(lang.interaction.divorce.prompts.dmFailed))
		}
	},
	"gift": {
		usage: "<amount: number|all|half>",
		description: "Gifts an amount of Discoins towards your waifu's price",
		aliases: ["gift"],
		category: "interaction",
		process: async function(msg, suffix, lang) {
			if (msg.channel instanceof Discord.DMChannel) return msg.channel.send(utils.replace(lang.interaction.gift.prompts.guildOnly, { "username": msg.author.username }))
			const args = suffix.split(" ")
			const waifu = await utils.waifu.get(msg.author.id, { basic: true })
			const money = await utils.coinsManager.get(msg.author.id)
			if (!waifu || !waifu.waifuID) return msg.channel.send(utils.replace(lang.interaction.gift.prompts.noWaifu, { "username": msg.author.username }))
			if (!args[0]) return msg.channel.send(utils.replace(lang.interaction.gift.prompts.noGift, { "username": msg.author.username }))
			let gift
			if (args[0] == "all" || args[0] == "half") {
				if (money == 0) return msg.channel.send(utils.replace(lang.interaction.gift.prompts.moneyInsufficient, { "username": msg.author.username }))
				if (args[0] == "all") {
					gift = money
				} else {
					gift = Math.floor(money / 2)
				}
			} else {
				gift = Math.floor(Number(args[0]))
				if (isNaN(gift)) return msg.channel.send(utils.replace(lang.interaction.gift.prompts.invalidGift, { "username": msg.author.username }))
				if (gift < 1) return msg.channel.send(utils.replace(lang.interaction.gift.prompts.giftSmall, { "username": msg.author.username }))
				if (gift > money) return msg.channel.send(utils.replace(lang.interaction.gift.prompts.moneyInsufficient, { "username": msg.author.username }))
			}
			await utils.waifu.transact(msg.author.id, gift)
			await utils.coinsManager.award(msg.author.id, -gift)
			const user = await client.users.fetch(waifu.waifuID)
			return msg.channel.send(utils.replace(lang.interaction.gift.returns.gifted, { "tag1": msg.author.tag, "number": gift, "tag2": user.tag }))
		}
	},
	"waifuleaderboard": {
		usage: "[local] [page: number]",
		description: "Displays the leaderboard of the top waifus",
		aliases: ["waifuleaderboard", "waifulb"],
		category: "interaction",
		process: async function(msg, suffix, lang) {
			const maxPages = 20
			const itemsPerPage = 10

			const args = suffix.split(" ")

			// Set up local
			const inputLocalArg = args[0]
			const isLocal = ["local", "guild", "server"].includes(args[0])
			if (isLocal) {
				args.shift() // if it exists, page number will now definitely be in args[0]
				if (msg.channel instanceof Discord.DMChannel) return msg.channel.send(utils.replace(lang.gambling.coins.prompts.guildOnly, { "username": msg.author.username }))
			}

			// Set up page number
			let pageNumber = +args[0]
			if (!isNaN(pageNumber)) {
				pageNumber = Math.max(Math.floor(pageNumber), 1)
			} else {
				pageNumber = 1
			}

			if (pageNumber > maxPages) {
				return msg.channel.send(utils.replace(lang.gambling.leaderboard.prompts.pageLimit, { "username": msg.author.username, "maxPages": maxPages }))
			}

			// Get all the rows
			let rows = null
			let availableRowCount = null
			const offset = (pageNumber - 1) * itemsPerPage
			if (isLocal) {
				if (msg.channel instanceof Discord.DMChannel) return msg.channel.send(utils.replace(lang.interaction.waifu.prompts.guildOnly, { "username": msg.author.username }))
				const memberIDs = [...msg.guild.members.keys()]
				rows = await utils.sql.all(`SELECT * FROM waifu WHERE userID IN (${Array(memberIDs.length).fill("?").join(", ")}) ORDER BY price DESC LIMIT ? OFFSET ?`, [...memberIDs, itemsPerPage, offset])
				availableRowCount = (await utils.sql.get(`SELECT count(*) AS count FROM waifu WHERE userID IN (${Array(memberIDs.length).fill("?").join(", ")})`, memberIDs)).count
			} else {
				rows = await utils.sql.all("SELECT * FROM waifu ORDER BY price DESC LIMIT ? OFFSET ?", [itemsPerPage, offset])
				availableRowCount = (await utils.sql.get("SELECT count(*) AS count FROM waifu")).count
			}

			const lastAvailablePage = Math.min(Math.ceil(availableRowCount / itemsPerPage), maxPages)
			const title = isLocal ? "Local Waifu Leaderboard" : "Waifu Leaderboard"
			const footerHelp = isLocal ? `&waifulb ${inputLocalArg} [page]` : "&waifulb [page]"

			if (rows.length) {
				const usersToResolve = new Set()
				const userTagMap = new Map()
				for (const row of rows) {
					usersToResolve.add(row.userID)
					usersToResolve.add(row.waifuID)
				}
				await Promise.all([...usersToResolve].map(userID =>
					client.users.fetch(userID, false)
						.then(user => user.tag)
						.catch(() => userID) // fall back to userID if user no longer exists
						.then(display => userTagMap.set(userID, display))
				))
				const displayRows = rows.map((row, index) => {
					const ranking = itemsPerPage * (pageNumber - 1) + index + 1
					return `${ranking}. ${userTagMap.get(row.userID)} claimed ${userTagMap.get(row.waifuID)} for ${row.price} ${emojis.discoin}`
				})
				const embed = new Discord.MessageEmbed()
					.setTitle(title)
					.setDescription(displayRows.join("\n"))
					.setFooter(`Page ${pageNumber} of ${lastAvailablePage} | ${footerHelp}`) // SC: U+2002 EN SPACE
					.setColor(constants.money_embed_color)
				return msg.channel.send(utils.contentify(msg.channel, embed))
			} else {
				const embed = new Discord.MessageEmbed()
					.setAuthor(title)
					.setDescription(utils.replace(lang.interaction.waifuleaderboard.returns.emptyPage, { "lastPage": lastAvailablePage }))
					.setFooter(footerHelp)
					.setColor(constants.money_embed_color)
				return msg.channel.send(utils.contentify(msg.channel, embed))
			}
		}
	},
	"bean": {
		usage: "<user>",
		description: "Beans a user",
		aliases: ["bean"],
		category: "interaction",
		process: async function(msg, suffix, lang) {
			if (msg.channel instanceof Discord.DMChannel) return msg.channel.send(utils.replace(lang.interaction.bean.prompts.guildOnly, { "username": msg.author.username }))
			if (!suffix) return msg.channel.send(utils.replace(lang.interaction.bean.prompts.invalidUser, { "username": msg.author.username }))
			const member = await msg.guild.findMember(msg, suffix, true)
			if (!member) return msg.channel.send(utils.replace(lang.interaction.bean.prompts.invalidUser, { "username": msg.author.username }))
			if (member.id == client.user.id) return msg.channel.send("No u")
			if (member.id == msg.author.id) return msg.channel.send(utils.replace(lang.interaction.bean.prompts.selfBean, { "username": msg.author.username }))
			return msg.channel.send(utils.replace(lang.interaction.bean.returns.beaned, { "tag": `**${member.user.tag}**` }))
		}
	}
}

const interactionSources = [
	{
		name: "hug", // Command object key and text filler
		description: "Hugs someone", // Command description
		shortcut: "nekos.life", // nekos.life: use the command name as the endpoint
		traaOverride: true // don't set this true for newly added types
	},
	{
		name: "nom",
		description: "Noms someone",
		shortcut: "durl", // Dynamic URL: call the function "url" and use its response as the GIF URL. Not async.
		url: () => { return getGif("nom") }
	},
	{
		name: "kiss",
		description: "Kisses someone",
		shortcut: "nekos.life",
		traaOverride: true
	},
	{
		name: "cuddle",
		description: "Cuddles someone",
		shortcut: "nekos.life",
		traaOverride: true
	},
	{
		name: "poke",
		description: "Pokes someone",
		shortcut: "nekos.life"
	},
	{
		name: "slap",
		description: "Slaps someone",
		shortcut: "nekos.life"
	},
	{
		name: "boop",
		description: "Boops someone",
		shortcut: "durl",
		url: () => { return getGif("boop") }
	},
	{
		name: "pat",
		description: "Pats someone",
		shortcut: "nekos.life",
		traaOverride: true
	}
]

for (const source of interactionSources) {
	const newCommand = {
		"interaction-command": {
			usage: "<user>",
			description: source.description,
			aliases: [source.name],
			category: "interaction",
			/**
			 * @param {Discord.Message} msg
			 * @param {string} suffix
			 * @param {import("@amanda/lang").Lang} lang
			 */
			process: (msg, suffix, lang) => doInteraction(msg, suffix, source, lang)
		}
	}
	commands.assign(newCommand)
}

const attempts = [
	(type, g1, g2) => utils.sql.all("select url, GenderGifCharacters.gifid, count(GenderGifCharacters.gifid) as count from GenderGifsV2 inner join GenderGifCharacters on GenderGifsV2.gifid = GenderGifCharacters.gifid where type = ? and (((gender like ? or gender = '*') and importance = 0) or ((gender like ? or gender = '*') and importance = 1)) group by GenderGifCharacters.gifid having count(GenderGifCharacters.gifid) >= 2", [type, g1, g2]),
	(type, g1, g2) => utils.sql.all("select url, GenderGifCharacters.gifid, count(GenderGifCharacters.gifid) as count from GenderGifsV2 inner join GenderGifCharacters on GenderGifsV2.gifid = GenderGifCharacters.gifid where type = ? and (((gender like ? or gender = '*') and importance = 0) or ((gender like ? or gender = '*') and importance = 1)) group by GenderGifCharacters.gifid having count(GenderGifCharacters.gifid) >= 2", [type, g2, g1]),
	(type, g1, g2) => utils.sql.all("select url, GenderGifCharacters.gifid from GenderGifsV2 inner join GenderGifCharacters on GenderGifsV2.gifid = GenderGifCharacters.gifid where type = ? and (gender like ? or gender = '*')", [type, (g2 == "_" ? g1 : g2)])
]

const genderMap = new Map([
	["474711440607936512", "f"],
	["474711506551046155", "m"],
	["474711526247366667", "n"],
	["316829871206563840", "f"],
	["316829948616638465", "m"]
])

/**
 * @param {Discord.Message} msg
 * @param {string} suffix
 * @param {{name: string, description: string, shortcut: string, fetch?: () => Promise<string>, footer?: string, traaOverride?: boolean, url?: () => Promise<string>}} source
 * @param {import("@amanda/lang").Lang} lang
 */
async function doInteraction(msg, suffix, source, lang) {
	if (msg.channel.type == "dm") return msg.channel.send(utils.replace(lang.interaction[source.name].prompts.dm, { "action": source.name }))
	if (!suffix) return msg.channel.send(utils.replace(lang.interaction[source.name].prompts.noUser, { "action": source.name }))
	const member = await msg.guild.findMember(msg, suffix)
	if (!member) return msg.channel.send("Invalid user")
	if (member.user.id == msg.author.id) return msg.channel.send(utils.arrayRandom(responses))
	if (member.user.id == client.user.id) return msg.channel.send(utils.replace(lang.interaction[source.name].returns.amanda, { "username": msg.author.username }))
	let fetch
	if (source.traaOverride) {
		const g1 = msg.member.roles.map(r => genderMap.get(r.id)).find(r => r) || "_"
		const g2 = member.roles.map(r => genderMap.get(r.id)).find(r => r) || "_"
		// console.log(msg.member.user.username, g1, member.user.username, g2)
		if (g1 != "_" || g2 != "_") {
			let found = false
			let i = 0
			while (!found && i < attempts.length) {
				const rows = await attempts[i](source.name, g1, g2)
				if (rows.length) {
					fetch = Promise.resolve(utils.arrayRandom(rows).url)
					found = true
				}
				i++
			}
		}
	}
	if (!fetch) {
		if (source.fetch) fetch = source.fetch()
		if (source.shortcut == "nekos.life") {
			source.footer = "Powered by nekos.life"
			fetch = new Promise((resolve, reject) => {
				rp(`https://nekos.life/api/v2/img/${source.name}`).then(body => {
					const data = JSON.parse(body)
					resolve(data.url)
				}).catch(reject)
			})
		} else if (source.shortcut == "durl") fetch = source.url()
		else fetch = Promise.reject(new Error("Shortcut didn't match a function."))
	}
	fetch.then(url => {
		const embed = new Discord.MessageEmbed()
			.setDescription(utils.replace(lang.interaction[source.name].returns.action, { "username": msg.author.username, "action": source.name, "mention": `<@${member.id}>` }))
			.setImage(url)
			.setColor("36393E")
		if (source.footer) embed.setFooter(source.footer)
		return msg.channel.send(utils.contentify(msg.channel, embed))
	}).catch(error => { return msg.channel.send(`There was an error: \`\`\`\n${error}\`\`\``) })
}

/**
 * @param {string} type
 * @returns {Promise<string>}
 */
async function getGif(type) {
	const gif = await utils.sql.get("SELECT * FROM InteractionGifs WHERE type =? ORDER BY RAND()", type)
	return gif.url
}

commands.assign(cmds)
