const Discord = require('discord.js');
const mined = new Set();
const Config = require("../config.json");

function findMember(msg, suffix, self = false) {
  if (!suffix) {
    if (self) return msg.member
    else return null
  } else {
    let member = msg.mentions.members.first() || msg.guild.members.get(suffix) || msg.guild.members.find(m => m.displayName.toLowerCase().includes(suffix.toLowerCase()) || m.user.username.toLowerCase().includes(suffix.toLowerCase()));
    return member
  }
}

module.exports = function(passthrough) {
  const { Discord, djs, dio, dbs } = passthrough;
  let sql = dbs[0];
  return {
    "dice": {
      usage: "",
      description: "Rolls two six sided die",
      process: function(msg, suffix) {
        msg.channel.send(`You rolled a ${Math.floor(Math.random() * (6 - 1) + 1)} and a ${Math.floor(Math.random() * (6 - 1) + 1)}`);
      }
    },

    "slot": {
      usage: "<bet>",
      description: "Runs a random slot machine for a chance at Discoins",
      process: async function(msg, suffix) {
        if (msg.channel.type == "dm") return msg.channel.send(`You cannot use this command in DMs`);
        var money = await sql.get(`SELECT * FROM money WHERE userID =?`, msg.author.id);
        if (!money) {
          await sql.run("INSERT INTO money (userID, coins) VALUES (?, ?)", [msg.author.id, 5000]);
          await msg.channel.send(`Created user account`);
          var money = await sql.get(`SELECT * FROM money WHERE userID =?`, msg.author.id);
        }
        var args = suffix.split(" ");
        var array = ['apple', 'cherries', 'watermelon', 'pear', 'heart'];
        var slot1 = array[Math.floor(Math.random() * array.length)];
        var slot2 = array[Math.floor(Math.random() * array.length)];
        var slot3 = array[Math.floor(Math.random() * array.length)];
        if (!args[0]) {
          const embed = new Discord.RichEmbed()
            .setImage(`https://github.com/bitsnake/resources/blob/master/Bot/Slots/AmandaSlots-${slot1}-${slot2}-${slot3}.png?raw=true`)
            .setColor("36393E")
          return msg.channel.send({embed});
        }
        if (args[0] == "all") {
          if (money.coins == 0) return msg.channel.send(`${msg.author.username}, you don't have any <a:Discoin:422523472128901140> to bet with!`);
          var bet = money.coins;
        } else {
          if (isNaN(args[0])) return msg.channel.send(`${msg.author.username}, that is not a valid bet`);
          var bet = Math.floor(parseInt(args[0]));
          if (bet < 1) return msg.channel.send(`${msg.author.username}, you cannot make a bet less than 1`);
          if (bet > money.coins) return msg.channel.send(`${msg.author.username}, you don't have enough <a:Discoin:422523472128901140> to make that bet`);
        }
        var result = `**${msg.author.tag}**, `;
        if (slot1 == "heart" && slot1 == slot2 && slot2 == slot3) {
          result += `WOAH! Triple :heart: You won ${bet * 30} <a:Discoin:422523472128901140>`;
          sql.run(`UPDATE money SET coins =? WHERE userID =?`, [money.coins + (bet * 29), msg.author.id]);
        } else if (slot1 == "heart" && slot1 == slot2 || slot1 == "heart" && slot1 == slot3) {
          result += `Wow! Double :heart: You won ${bet * 4} <a:Discoin:422523472128901140>`;
          sql.run(`UPDATE money SET coins =? WHERE userID =?`, [money.coins + (bet * 3), msg.author.id]);
        } else if (slot2 == "heart" && slot2 == slot3) {
          result += `Wow! Double :heart: You won ${bet * 4} <a:Discoin:422523472128901140>`;
          sql.run(`UPDATE money SET coins =? WHERE userID =?`, [money.coins + (bet * 3), msg.author.id]);
        } else if (slot1 == "heart" || slot2 == "heart" || slot3 == "heart") {
          result += `A single :heart: You won your bet back`;
        } else if (slot1 == slot2 && slot2 == slot3) {
          result += `A triple. You won ${bet * 10} <a:Discoin:422523472128901140>`;
          sql.run(`UPDATE money SET coins =? WHERE userID =?`, [money.coins + (bet * 9), msg.author.id]);
        } else {
          result += `Sorry. You didn't get a match. You lost ${bet} <a:Discoin:422523472128901140>`;
          sql.run(`UPDATE money SET coins =? WHERE userID =?`, [money.coins - bet, msg.author.id]);
        }
        const embed = new Discord.RichEmbed()
          .setDescription(result)
          .setImage(`https://github.com/bitsnake/resources/blob/master/Bot/Slots/AmandaSlots-${slot1}-${slot2}-${slot3}.png?raw=true`)
          .setColor("36393E")
        msg.channel.send({embed});
      }
    },

    "flip": {
      usage: "",
      description: "Flips a coin",
      process: function(msg, suffix) {
        var array = ['heads <:coinH:402219464348925954>', 'tails <:coinT:402219471693021196>'];
        var flip = array[Math.floor(Math.random() * array.length)];
        msg.channel.send(`You flipped ${flip}`);
      }
    },

    "bf": {
      usage: "<bet> <side (h or t)>",
      description: "Place a bet on a random flip for a chance of Discoins",
      process: async function(msg, suffix) {
        if (msg.channel.type == "dm") return msg.channel.send(`You cannot use this command in DMs`);
        var args = suffix.split(" ");
        var money = await sql.get(`SELECT * FROM money WHERE userID =?`, msg.author.id);
        if (!money) {
          await sql.run("INSERT INTO money (userID, coins) VALUES (?, ?)", [msg.author.id, 5000]);
          await msg.channel.send(`Created user account`);
          var money = await sql.get(`SELECT * FROM money WHERE userID =?`, msg.author.id);
        }
        if (!args[0]) return msg.channel.send(`${msg.author.username}, you need to provide a bet and a side to bet on`);
        if (args[0] == "all") {
          if (money.coins == 0) return msg.channel.send(`${msg.author.username}, you don't have any <a:Discoin:422523472128901140> to bet with!`);
          var bet = money.coins;
        } else {
          if (isNaN(args[0])) return msg.channel.send(`${msg.author.username}, that is not a valid bet`);
          var bet = Math.floor(parseInt(args[0]));
          if (bet < 1) return msg.channel.send(`${msg.author.username}, you cannot make a bet less than 1`);
          if (bet > money.coins) return msg.channel.send(`${msg.author.username}, you don't have enough <a:Discoin:422523472128901140> to make that bet`);
        }
        if (!args[1]) return msg.channel.send(`${msg.author.username}, you need to provide a side to bet on. Valid sides are h or t`);
        if (args[1] != "h" && args[1] != "t") return msg.channel.send(`${msg.author.username}, that's not a valid side to bet on`);
        var flip = Math.floor(Math.random() * (3 - 1) + 1);
        if (args[1] == "h" && flip == 1 || args[1] == "t" && flip == 2) {
          msg.channel.send(`You guessed it! you got ${bet * 2} <a:Discoin:422523472128901140>`);
          return sql.run(`UPDATE money SET coins =? WHERE userID =?`, [money.coins + bet, msg.author.id]);
        } else {
          msg.channel.send(`Sorry but you didn't guess correctly. Better luck next time`);
          return sql.run(`UPDATE money SET coins =? WHERE userID =?`, [money.coins - bet, msg.author.id]);
        }
      }
    },

    "coins": {
      usage: "<user>",
      description: "Returns the amount of Discoins you or another user has",
      process: async function(msg, suffix) {
        if (msg.channel.type == "dm") return msg.channel.send(`You cannot use this command in DMs`);
        var member = findMember(msg, suffix, true);
        if (member == null) return msg.channel.send(`Couldn't find that user`);
        var target = await sql.get(`SELECT * FROM money WHERE userID =?`, member.user.id);
        if (!target) {
          await sql.run("INSERT INTO money (userID, coins) VALUES (?, ?)", [member.user.id, 5000]);
          await msg.channel.send(`Created user account`);
          var target = await sql.get(`SELECT * FROM money WHERE userID =?`, member.user.id);
        }
        const embed = new Discord.RichEmbed()
          .setAuthor(`Coins for ${member.user.tag}`)
          .setDescription(`${target.coins} Discoins <a:Discoin:422523472128901140>`)
          .setColor("F8E71C")
        msg.channel.send({embed})
      }
    },

    "mine": {
      usage: "",
      description: "Mines for Discoins",
      process: async function(msg, suffix) {
        if (msg.channel.type == "dm") return msg.channel.send(`You cannot use this command in DMs`);
        var money = await sql.get(`SELECT * FROM money WHERE userID =?`, msg.author.id);
        if (!money) {
          await sql.run("INSERT INTO money (userID, coins) VALUES (?, ?)", [msg.author.id, 5000]);
          await msg.channel.send(`Created user account`);
          var money = await sql.get(`SELECT * FROM money WHERE userID =?`, msg.author.id);
        }
        if (mined.has(msg.author.id)) return msg.channel.send(`${msg.author.username}, you have already went mining within the past minute. Come back after it has been 1 minute.`);
        var mine = Math.floor(Math.random() * (100 - 1) + 1);
        const embed = new Discord.RichEmbed()
          .setDescription(`**${msg.author.username} went mining and got ${mine} <a:Discoin:422523472128901140> :pick:**`)
          .setColor("F8E71C")
        msg.channel.send({embed});
        sql.run(`UPDATE money SET coins =? WHERE userID =?`, [money.coins + mine, msg.author.id]);
        mined.add(msg.author.id);
        setTimeout(() => {
          mined.delete(msg.author.id);
        }, 60000);
      }
    },

    "lb": {
      usage: "",
      description: "Gets the leaderboard for people with the most coins",
      process: async function(msg, suffix) {
        var all = await sql.all("SELECT * FROM money WHERE userID !=? ORDER BY coins DESC LIMIT 10", djs.user.id);
        let index = 0;
        const embed = new Discord.RichEmbed()
          .setAuthor("Leaderboards")
          .setDescription(all.map(row => `${++index}. ${dio.users[row.userID] ? dio.users[row.userID].username : row.userID} :: ${row.coins} <a:Discoin:422523472128901140>`).join("\n"))
          .setColor("F8E71C")
        msg.channel.send({embed});
      }
    },

    "give": {
      usage: "<amount> <user>",
      description: "Gives discoins to a user from your account",
      process: async function(msg, suffix) {
        if (msg.channel.type == "dm") return msg.channel.send(`You cannot use this command in DMs`);
        var args = suffix.split(" ");
        if (!args[0]) return msg.channel.send(`${msg.author.username}, you have to provide an amount to give and then a user`);
        var usertxt = msg.content.substring(Config.commandPrefix.length + args[0].length + 6);
        if (!usertxt) return msg.channel.send(`${msg.author.username}, you need to provide a user to give to`);
        var member = findMember(msg, usertxt);
        if (member == null) return msg.channel.send("Could not find that user");
        if (member.user.id == msg.author.id) return msg.channel.send(`You can't give coins to yourself, silly`);
        var author = await sql.get(`SELECT * FROM money WHERE userID =?`, msg.author.id);
        var target = await sql.get(`SELECT * FROM money WHERE userID =?`, member.user.id);
        if (!target) {
          await sql.run("INSERT INTO money (userID, coins) VALUES (?, ?)", [member.user.id, 5000]);
          await msg.channel.send(`Created user account`);
          var target = await sql.get(`SELECT * FROM money WHERE userID =?`, member.user.id);
        }
        if (!author) {
          await sql.run("INSERT INTO money (userID, coins) VALUES (?, ?)", [msg.author.id, 5000]);
          await msg.channel.send(`Created user account`);
          var author = await sql.get(`SELECT * FROM money WHERE userID =?`, msg.author.id);
        }
        if (args[0] == "all") {
          if (author.coins == 0) return msg.channel.send(`${msg.author.username}, you don't have any <a:Discoin:422523472128901140> to give!`);
          var gift = author.coins;
        } else {
          if (isNaN(args[0])) return msg.channel.send(`${msg.author.username}, that is not a valid amount to give`);
          var gift = Math.floor(parseInt(args[0]));
          if (gift < 1) return msg.channel.send(`${msg.author.username}, you cannot give less than 1`);
          if (gift > author.coins) return msg.channel.send(`${msg.author.username}, you don't have enough <a:Discoin:422523472128901140> to make that transaction`);
        }
        sql.run(`UPDATE money SET coins =? WHERE userID=?`, [author.coins - gift, msg.author.id]);
        sql.run(`UPDATE money SET coins =? WHERE userID=?`, [target.coins + gift, member.user.id]);
        const embed = new Discord.RichEmbed()
          .setDescription(`**${msg.author.tag}** has given ${gift} Discoins to **${member.user.tag}**`)
          .setColor("F8E71C")
        msg.channel.send({embed});
        member.send(`**${msg.author.tag}** has given you ${gift} <a:Discoin:422523472128901140>`).catch(() => msg.channel.send("I tried to DM that member but they may have DMs disabled from me"));
      }
    },

    "award": {
      usage: "<amount> <user>",
      description: "Awards a specific user ",
      process: async function(msg, suffix) {
        var nope = [["no", 300], ["Nice try", 1000], ["How about no?", 1550], [`Don't even try it ${msg.author.username}`, 3000]];
        var [no, time] = nope[Math.floor(Math.random() * nope.length)];
        if (["320067006521147393"].includes(msg.author.id)) {
          if (msg.channel.type == "dm") return msg.channel.send(`You cannot use this command in DMs`);
          var args = suffix.split(" ");
          if (!args[0]) return msg.channel.send(`${msg.author.username}, you have to provide an amount to award and then a user`);
          if (isNaN(args[0])) return msg.channel.send(`${msg.author.username}, that is not a valid amount to award`);
          if (args[0] < 1) return msg.channel.send(`${msg.author.username}, you cannot award an amount less than 1`);
          var usertxt = msg.content.substring(Config.commandPrefix.length + args[0].length + 7)
          if (!usertxt) return msg.channel.send(`${msg.author.username}, you need to provide a user to award`);
          var member = findMember(msg, usertxt);
          if (member == null) return msg.channel.send("Could not find that user");
          if (member.user.id == msg.author.id) return msg.channel.send(`You can't award yourself, silly`);
          var target = await sql.get(`SELECT * FROM money WHERE userID =?`, member.user.id);
          if (!target) {
            await sql.run("INSERT INTO money (userID, coins) VALUES (?, ?)", [member.user.id, 5000]);
            await msg.channel.send(`Created user account`);
            var target = await sql.get(`SELECT * FROM money WHERE userID =?`, member.user.id);
          }
          var award = parseInt(args[0]);
          var award = Math.floor(award);
          sql.run(`UPDATE money SET coins =? WHERE userID=?`, [target.coins + award, member.user.id]);
          const embed = new Discord.RichEmbed()
            .setDescription(`**${msg.author.tag}** has awarded ${award} Discoins to **${member.user.tag}**`)
            .setColor("F8E71C")
          msg.channel.send({embed});
          member.send(`**${msg.author.tag}** has awarded you ${award} <a:Discoin:422523472128901140>`).catch(() => msg.channel.send("I tried to DM that member but they may have DMs disabled from me"));
        } else {
           msg.channel.startTyping();
           setTimeout(() => {
             msg.channel.send(no).then(() => msg.channel.stopTyping());
          }, time)
        }
      }
    },

    "waifu": {
      usage: "<user>",
      description: "Gets the waifu information about yourself or a user",
      process: async function(msg, suffix) {
        if (msg.channel.type == "dm") return msg.channel.send(`You cannot use this command in DMs`);
        var member = findMember(msg, suffix, true);
        if (member == null) return msg.channel.send(`Couldn't find that user`);
        var waifu = await sql.get(`SELECT * FROM waifu WHERE userID =?`, member.user.id);
        if (!waifu) {
          await sql.run(`INSERT INTO waifu (userID, waifuID, price, claimedByID) VALUES (?, ?, ?, ?)`, [member.user.id, null, null, null]);
          await msg.channel.send(`Created user account`);
          var waifu = await sql.get(`SELECT * FROM waifu WHERE userID =?`, member.user.id);
        }
        const embed = new Discord.RichEmbed()
          .setAuthor(`Waifu ${member.user.tag}`)
          .addField(`Price:`, waifu.price || 0)
          .addField(`Claimed by:`, dio.users[waifu.claimedByID] ? dio.users[waifu.claimedByID].username : waifu.claimedByID || "Nobody")
          .addField(`Waifu:`, dio.users[waifu.waifuID] ? dio.users[waifu.waifuID].username : waifu.waifuID || "Nobody")
          .setColor("36393E")
        msg.channel.send({embed});
      }
    },

    "claim": {
      usage: "<price> <user>",
      description: "Claims someone as a waifu. Requires Discoins",
      process: async function(msg, suffix) {
        var array = [["Soon", 500], ["It's almost here", 1200], ["Not too much longer of a wait", 2000]];
        var [soon, time] = array[Math.floor(Math.random() * array.length)];
        msg.channel.startTyping();
        setTimeout(() => {
          msg.channel.send(soon).then(() => msg.channel.stopTyping());
        }, time)
      }
    },

    "invest": {
      usage: "<amount> <user>",
      description: "Invests Discoins into your waifu",
      process: async function(msg, suffix) {
        var array = [["Soon", 500], ["It's almost here", 1200], ["Not too much longer of a wait", 2000]];
        var [soon, time] = array[Math.floor(Math.random() * array.length)];
        msg.channel.startTyping();
        setTimeout(() => {
          msg.channel.send(soon).then(() => msg.channel.stopTyping());
        }, time)
      }
    }
  }
}