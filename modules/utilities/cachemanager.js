// @ts-check

const Discord = require("thunderstorm")

const passthrough = require("../../passthrough")
const { client, constants, cache } = passthrough

const { contentify, createMessageCollector } = require("./discordutils")
const sql = require("./sql")

const cacheInserthandler = require("../../cacheHandler")

const SnowflakeUtil = require("discord.js/src/util/Snowflake")

const permissionstable = {
	CREATE_INSTANT_INVITE: 0x00000001,
	KICK_MEMBERS: 0x00000002,
	BAN_MEMBERS: 0x00000004,
	ADMINISTRATOR: 0x00000008,
	MANAGE_CHANNELS: 0x00000010,
	MANAGE_GUILD: 0x00000020,
	ADD_REACTIONS: 0x00000040,
	VIEW_AUDIT_LOG: 0x00000080,
	PRIORITY_SPEAKER: 0x00000100,
	STREAM: 0x00000200,
	VIEW_CHANNEL: 0x00000400,
	SEND_MESSAGES: 0x00000800,
	SEND_TTS_MESSAGES: 0x00001000,
	MANAGE_MESSAGES: 0x00002000,
	EMBED_LINKS: 0x00004000,
	ATTACH_FILES: 0x00008000,
	READ_MESSAGE_HISTORY: 0x00010000,
	MENTION_EVERYONE: 0x00020000,
	USE_EXTERNAL_EMOJIS: 0x00040000,
	VIEW_GUILD_INSIGHTS: 0x00080000,
	CONNECT: 0x00100000,
	SPEAK: 0x00200000,
	MUTE_MEMBERS: 0x00400000,
	DEAFEN_MEMBERS: 0x00800000,
	MOVE_MEMBERS: 0x01000000,
	USE_VAD: 0x02000000,
	CHANGE_NICKNAME: 0x04000000,
	MANAGE_NICKNAMES: 0x08000000,
	MANAGE_ROLES: 0x10000000,
	MANAGE_WEBHOOKS: 0x20000000,
	MANAGE_EMOJIS: 0x40000000,
	ALL: 0x00000000
}

for (const key of Object.keys(permissionstable)) {
	if (key === "ALL") continue
	permissionstable["ALL"] = permissionstable["ALL"] | permissionstable[key]
}

const channelManager = {
	/**
	 * @param {string} id
	 * @param {boolean} [fetch]
	 * @param {boolean} [convert]
	 */
	get: async function(id, fetch = false, convert = true) {
		/** @type {import("@amanda/discordtypings").ChannelData} */
		// @ts-ignore
		const d = await sql.get("SELECT * FROM Channels WHERE id =?", id, cache)
		if (d) {
			if (convert) return channelManager.parse(d)
			else return d
		} else {
			if (fetch) {
				const fetched = await channelManager.fetch(id)
				if (fetched) {
					// @ts-ignore
					if (convert) return channelManager.parse(fetched)
					else return fetched
				} else return null
			} else return null
		}
	},
	/**
	 * @param {string} id
	 */
	fetch: async function(id) {
		const d = await client._snow.channel.getChannel(id)
		// @ts-ignore
		if (d) await cacheInserthandler.handleChannel(d, d.guild_id)
		return d || null
	},
	/**
	 * Find a channel in a guild
	 * @param {Discord.Message} message Message Object
	 * @param {string} string String to search channels by
	 * @param {boolean} [self=false] If the function should return `message`.channel
	 * @returns {Promise<?Discord.TextChannel | Discord.VoiceChannel>}
	 */
	find: function(message, string, self) {
		// eslint-disable-next-line no-async-promise-executor
		return new Promise(async (res) => {
			// @ts-ignore
			if (await channelManager.typeOf(message.channel) === "dm") return res(null)
			string = string.toLowerCase()
			if (/<#(\d+)>/.exec(string)) string = /<#(\d+)>/.exec(string)[1]
			if (!string) {
				// @ts-ignore
				if (self) return channelManager.get(message.channel.id, true, true).then(data => res(data))
				else return res(null)
			} else {
				const channeldata = await channelManager.filter(string, { guild_id: message.guild.id })
				if (!channeldata) return res(null)
				/** @type {Array<Discord.TextChannel | Discord.VoiceChannel>} */
				const list = []
				const channels = channeldata.filter(chan => chan.type == 0 || chan.type == 2)
				for (const chan of channels) {
					if (list.find(item => item.id === chan.id) || list.length === 10) continue
					// @ts-ignore
					list.push(channelManager.parse(chan))
				}
				if (list.length == 1) return res(list[0])
				if (list.length == 0) return res(null)
				const embed = new Discord.MessageEmbed().setTitle("Channel selection").setDescription(list.map((item, i) => `${item.type == "voice" ? "<:voice:674569797278760961>" : "<:text:674569797278892032>"} ${i + 1}. ${item.name}`).join("\n")).setFooter(`Type a number between 1 - ${list.length}`).setColor(constants.standard_embed_color)
				const selectmessage = await message.channel.send(await contentify(message.channel, embed))
				const cb = (newmessage) => {
					const index = Number(newmessage.content)
					if (!index || !list[index - 1]) return onFail()
					selectmessage.delete()
					// eslint-disable-next-line no-empty-function
					newmessage.delete().catch(() => {})
					return res(list[index - 1])
				}
				// eslint-disable-next-line no-inner-declarations
				async function onFail() {
					embed.setTitle("Channel selection cancelled").setDescription("").setFooter("")
					selectmessage.edit(await contentify(selectmessage.channel, embed))
					return res(null)
				}
				createMessageCollector({ channelID: message.channel.id, userIDs: [message.author.id] }, cb, onFail)
			}
		})
	},
	/**
	 * @param {string} [search]
	 * @param {Object.<string, any>} [where]
	 * @param {number} [limit]
	 */
	filter: async function(search, where = undefined, limit = 10) {
		const wherekeys = (Object.keys(where || {}) || [])
		const wherevalues = (Object.values(where || {}) || [])

		const wherestatement = wherekeys.map(item => `${item} =?`).join(" AND ")

		const ds = await sql.all(`SELECT * FROM Channels WHERE (id LIKE ? OR name LIKE ?) ${where ? `AND ${wherestatement} ` : ""}LIMIT ${limit}`, [`%${search}%`, `%${search}%`, ...wherevalues], cache)
		return ds
	},
	parse: function(channel) {
		const type = channel.type
		if (type == 0) return new Discord.TextChannel(channel, client)
		else if (type == 1) return new Discord.DMChannel(channel, client)
		else if (type == 2) return new Discord.VoiceChannel(channel, client)
		else if (type == 4) return new Discord.CategoryChannel(channel, client)
		else if (type == 5) return new Discord.NewsChannel(channel, client)
		else return new Discord.Channel(channel, client)
	},
	/**
	 * @param {{ id: string }} channel
	 */
	typeOf: async function(channel) {
		const chan = await channelManager.get(channel.id, true, false)
		if (chan) {
			if (chan.type == 0) return "text"
			else if (chan.type == 1) return "dm"
			else if (chan.type == 2) return "voice"
			else if (chan.type == 4) return "category"
			else if (chan.type == 5) return "news"
			else if (chan.type == 6) return "store"
			else return "text"
		} else return "text"
	},
	/**
	 * @param {{ id: string }} channel
	 */
	getOverridesFor: async function(channel) {
		const value = { allow: 0x00000000, deny: 0x00000000 }
		const perms = await sql.get("SELECT * FROM PermissionOverwrites WHERE channel_id = ? AND id =?", [channel.id, client.user.id], cache) // get permission overwrite data from cache
		if (perms) {
			value.allow |= (perms.allow || 0)
			value.deny |= (perms.deny || 0)
		}
		return value
	},
	/**
	 * @param {{ id: string, guild_id: string }} channel
	 * @returns {Promise<{ allow: number, deny: number }>}
	 */
	permissionsFor: async function(channel) {
		const value = { allow: 0x00000000, deny: 0x00000000 }
		if (!channel.guild_id) return { allow: permissionstable["ALL"], deny: 0x00000000 }

		const chanperms = await channelManager.getOverridesFor(channel)
		const guildperms = await guildManager.getOverridesFor(channel.guild_id)

		value.allow |= chanperms.allow
		value.deny |= chanperms.deny

		value.allow |= guildperms.allow
		value.deny |= guildperms.deny


		const clientmemdata = await memberManager.get(client.user.id, channel.guild_id, false, false) // get ClientUser member data in guild to get roles array
		if (!clientmemdata) return value

		/** @type {Array<string>} */
		// @ts-ignore
		const roles = clientmemdata.roles || []
		const roledata = await Promise.all(roles.map(role => sql.get("SELECT * FROM Roles WHERE id =? AND guild_id =?", [role, channel.guild_id], cache))) // get all role data from cache
		if (!roledata) return value
		for (const role of roledata) {
			if (!role) continue
			if (role.permissions) {
				value.allow |= role.permissions // OR together the permissions of each role
			}
		}

		return value
	},
	/**
	 * @param {{ id: string, guild_id: string }} channel
	 * @param {number | keyof permissionstable} permission
	 * @param {{ allow: number, deny: number }} [permissions]
	 */
	hasPermissions: async function(channel, permission, permissions) {
		if (!channel.guild_id) return true
		if (!permissions) permissions = await channelManager.permissionsFor(channel)

		/** @type {number} */
		let toCheck
		if (permissionstable[permission]) toCheck = permissionstable[permission]
		else if (typeof permission === "number") toCheck = permission
		// @ts-ignore
		else toCheck = permission

		if ((permissions.allow & toCheck) == toCheck) return true
		if ((permissions.deny & toCheck) == toCheck) return false
		else return true
	}
}

const userManager = {
	/**
	 * @param {string} id
	 * @param {boolean} [fetch]
	 * @param {boolean} [convert]
	 */
	get: async function(id, fetch = false, convert = true) {
		const d = await sql.get("SELECT * FROM Users WHERE id =?", id, cache)
		if (d) {
			if (convert) return userManager.parse(d)
			else return d
		} else {
			if (fetch) {
				const fetched = await userManager.fetch(id)
				if (fetched) {
					if (convert) return userManager.parse(fetched)
					else return fetched
				} else return null
			} else return null
		}
	},
	/**
	 * @param {string} id
	 */
	fetch: async function(id) {
		const d = await client._snow.user.getUser(id)
		if (d) await cacheInserthandler.handleUser(d)
		return d || null
	},
	/**
	 * @param {Discord.Message} message Message Object
	 * @param {string} string String to search users by
	 * @param {boolean} [self=false] If the function should return the `message` author's user Object
	 * @returns {Promise<?Discord.User>}
	 */
	find: function(message, string, self = false) {
		// eslint-disable-next-line no-async-promise-executor
		return new Promise(async (res) => {
			string = string.toLowerCase()
			if (/<@!?(\d+)>/.exec(string)) string = /<@!?(\d+)>/.exec(string)[1]
			if (!string) {
				if (self) return res(message.author)
				else return res(null)
			} else {
				const userdata = await userManager.filter(string)
				const list = []
				if (userdata) {
					for (const user of userdata) {
						if (list.find(item => item.id === user.id) || list.length === 10) continue
						// @ts-ignore
						list.push(new Discord.User(user, client))
					}
				}
				if (list.length == 1) return res(list[0])
				if (list.length == 0) {
					if (validate(string)) {
						let d
						try {
							d = await userManager.get(string, true)
						} catch (e) {
							return res(null)
						}
						// @ts-ignore
						return res(d)
					} else return res(null)
				}
				const embed = new Discord.MessageEmbed().setTitle("User selection").setDescription(list.map((item, i) => `${i + 1}. ${item.tag}`).join("\n")).setFooter(`Type a number between 1 - ${list.length}`).setColor(constants.standard_embed_color)
				const selectmessage = await message.channel.send(await contentify(message.channel, embed))
				const cb = (newmessage) => {
					const index = Number(newmessage.content)
					if (!index || !list[index - 1]) return res(null)
					selectmessage.delete()
					// eslint-disable-next-line no-empty-function
					if (message.channel.type != "dm") newmessage.delete().catch(() => {})
					return res(list[index - 1])
				}
				const onFail = async () => {
					embed.setTitle("User selection cancelled").setDescription("").setFooter("")
					selectmessage.edit(await contentify(selectmessage.channel, embed))
					return res(null)
				}
				createMessageCollector({ channelID: message.channel.id, userIDs: [message.author.id] }, cb, onFail)
			}
		})
	},
	/**
	 * @param {string} search
	 * @param {Object.<string, any>} [where]
	 * @param {number} [limit]
	 */
	filter: async function(search, where = undefined, limit = 10) {
		const wherekeys = (Object.keys(where || {}) || [])
		const wherevalues = (Object.values(where || {}) || [])

		const wherestatement = wherekeys.map(item => `${item} =?`).join(" AND ")

		const ds = await sql.all(`SELECT * FROM Users WHERE (id LIKE ? OR username LIKE ?) ${where ? `AND ${wherestatement} ` : ""}LIMIT ${limit}`, [`%${search}%`, `%${search}%`, ...wherevalues], cache)
		return ds
	},
	parse: function(user) {
		return new Discord.User(user, client)
	}
}

const memberManager = {
	/**
	 * @param {string} id
	 * @param {string} guildID
	 * @param {boolean} [fetch]
	 * @param {boolean} [convert]
	 */
	get: async function(id, guildID, fetch = false, convert = true) {
		const [md, ud] = await Promise.all([
			sql.get("SELECT * FROM Members WHERE id =? AND guild_id =?", [id, guildID], cache),
			userManager.get(id, true, false)
		])
		const roles = await sql.all("SELECT * FROM RoleRelations WHERE user_id =? AND guild_id =?", [id, guildID], cache).then(d => d.map(i => i.id))
		if (md && ud) {
			if (convert) return memberManager.parse({ roles, ...md }, ud)
			else return { user: ud, roles, ...md }
		} else {
			if (fetch) {
				const fetched = await memberManager.fetch(id, guildID)
				if (fetched) {
					// @ts-ignore
					if (convert) return memberManager.parse(fetched, fetched.user)
					else return fetched
				} else return null
			} else return null
		}
	},
	/**
	 * @param {string} id
	 * @param {string} guildID
	 */
	fetch: async function(id, guildID) {
		const md = await client._snow.guild.getGuildMember(guildID, id)
		const ud = await userManager.get(id, true, false)
		// @ts-ignore
		if (md && ud) await cacheInserthandler.handleMember(md, ud, guildID, client.user.id)
		return (md && ud) ? { id: ud.id, guild_id: guildID, user: ud, ...md } : null
	},
	/**
	 * @param {Discord.Message} message Message Object
	 * @param {string} string String to search members by
	 * @param {boolean} [self=false] If the function should return the `message` author's member Object
	 * @returns {?Promise<?Discord.GuildMember>}
	 */
	find: function(message, string, self = false) {
		// eslint-disable-next-line no-async-promise-executor
		return new Promise(async (res) => {
			string = string.toLowerCase()
			if (/<@!?(\d+)>/.exec(string)) string = /<@!?(\d+)>/.exec(string)[1]

			if (!string) {
				if (self) return res(message.member)
				else return res(null)
			} else {
				const userdata = await userManager.filter(string)

				/** @type {Array<Discord.GuildMember>} */
				const list = []
				for (const user of userdata) {
					if (list.find(item => item.id === user.id) || list.length === 10) continue
					// @ts-ignore
					let memdata
					const d = await sql.get("SELECT * FROM Members WHERE id =? AND guild_id =?", [user.id, message.guild.id], cache)
					if (d) {
						memdata = d
					} else memdata = { nick: null, joined_at: Date.now() }
					// @ts-ignore
					list.push(new Discord.GuildMember({ user: user, ...memdata }, client))
				}
				if (list.length == 1) return res(list[0])
				if (list.length == 0) return res(null)
				const embed = new Discord.MessageEmbed().setTitle("Member selection").setDescription(list.map((item, i) => `${i + 1}. ${item.user.tag}`).join("\n")).setFooter(`Type a number between 1 - ${list.length}`).setColor(constants.standard_embed_color)
				const selectmessage = await message.channel.send(await contentify(message.channel, embed))
				const cb = (newmessage) => {
					const index = parseInt(newmessage.content)
					if (!index || !list[index - 1]) return null
					selectmessage.delete()
					// eslint-disable-next-line no-empty-function
					newmessage.delete().catch(() => {})
					return res(list[index - 1])
				}
				const onFail = async () => {
					embed.setTitle("Member selection cancelled").setDescription("").setFooter("")
					selectmessage.edit(await contentify(message.channel, embed))
					return res(null)
				}
				createMessageCollector({ channelID: message.channel.id, userIDs: [message.author.id] }, cb, onFail)
			}
		})
	},
	/**
	 * @param {string} search
	 * @param {Object.<string, any>} [where]
	 * @param {number} [limit]
	 */
	filter: async function(search, where, limit = 10) {
		const wherekeys = (Object.keys(where || {}) || [])
		const wherevalues = (Object.values(where || {}) || [])

		const wherestatement = wherekeys.map(item => `${item} =?`).join(" AND ")

		let s = ""
		if (search) s = `(id LIKE ? OR nick LIKE ?) ${where ? `AND ${wherestatement} ` : ""} `

		const ds = await sql.all(`SELECT * FROM Members WHERE ${s} LIMIT ${limit}`, [...(search ? [`%${search}%`, `%${search}%`] : []), ...wherevalues], cache)
		return ds
	},
	parse: function(member, user) {
		return new Discord.GuildMember({ user: user, ...member }, client)
	}
}

const guildManager = {
	/**
	 * @param {string} id
	 * @param {boolean} [fetch]
	 * @param {boolean} [convert]
	 */
	get: async function(id, fetch = false, convert = true) {
		const d = await sql.get("SELECT * FROM Guilds WHERE id =?", id, cache)
		if (d) {
			if (convert) return guildManager.parse(d) // fetching all members, channels and userdata took too long so the Guild#channels and Guild#members Maps will be empty
			else return d
		} else {
			if (fetch) {
				const fetched = await guildManager.fetch(id)
				if (fetched) {
					// @ts-ignore
					if (convert) return guildManager.parse(fetched)
					else return fetched
				} else return null
			} else return null
		}
	},
	/**
	 * @param {string} id
	 */
	fetch: async function(id) {
		const d = await client._snow.guild.getGuild(id)
		// @ts-ignore
		if (d) await cacheInserthandler.handleGuild(d)
		return d || null
	},
	parse: function(guild) {
		return new Discord.Guild(guild, client)
	},
	/**
	 * @param {string} id
	 */
	async getOverridesFor(id) {
		const value = { allow: 0x00000000, deny: 0x00000000 }
		const guild = await guildManager.get(id, true, false)
		if (guild) {
			// @ts-ignore
			value.allow |= (guild.permissions || 0)
		}
		return value
	}
}

/**
 * Validates if a string is *possibly* a valid Snowflake
 * @param {string} id
 */
function validate(id) {
	if (!(/^\d+$/.test(id))) return false

	const deconstructed = SnowflakeUtil.deconstruct(id)
	if (!deconstructed || !deconstructed.date) return false
	if (deconstructed.date.getTime() > Date.now()) return false
	return true
}

module.exports.cacheManager = { validate, users: userManager, channels: channelManager, members: memberManager, guilds: guildManager }