// @ts-check

const crypto = require("crypto")

const passthrough = require("../passthrough")

const { commands, reloader } = passthrough

const utils = require("../modules/utilities")
reloader.sync("./modules/utilities/index.js", utils)

commands.assign([
	{
		usage: "<message ID>",
		description: "Link a webhook account to your account. The webhook will be able to act as you.",
		aliases: ["webhookalias"],
		category: "admin",
		/**
		 * @param {import("thunderstorm").Message} msg
		 * @param {string} suffix
		 */
		process(msg, suffix) {
			const messageID = suffix
			new Promise((resolve, reject) => {
				if (!messageID.match(/^\d+$/)) reject(new Error("Not a number"))
				resolve(msg.channel.fetchMessage(messageID))
			}).then(
				/** @param {import("thunderstorm").Message} link */
				async link => {
					if (!link.webhookID) {
						msg.channel.send("That message wasn't sent by a webhook.")
					} else {
						const checkString = crypto.randomBytes(12).toString("hex")
						const checkMessage = await msg.channel.send(`To confirm, the webhook must now send this message: \`${checkString}\``)
						utils.createMessageCollector({ channelID: msg.channel.id, userIDs: [link.webhookID] }, (confirmation) => {
							if (confirmation.content !== checkString) {
								msg.channel.send("That's not the right confirmation code.")
							} else {
								utils.sql.all(
									"INSERT INTO WebhookAliases (webhookID, webhook_username, userID, user_username, user_discriminator) \
									VALUES (?, ?, ?, ?, ?)",
									[link.webhookID, link.author.username, msg.author.id, msg.author.username, msg.author.discriminator]
								)
								msg.channel.send("Alias created. The webhook can now act as you.")
							}
						}, () => {
							checkMessage.edit("Timed out.")
						})
					}
				}).catch(() => {
				msg.channel.send("That's not a valid message ID.")
			})
		}
	}
])
