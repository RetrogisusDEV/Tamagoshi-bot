const os = require("os");
const imgur = require("imgur-node-api");
const { readFileSync, writeFile } = require("fs");
const ping = require("ping");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

const token = process.env.BOT_TOKEN;
let db;
try {
    db = JSON.parse(readFileSync("./db.json"));
} catch (error) {
    console.error("Error reading db.json:", error);
    db = {}; // Initialize db as an empty object if reading fails
}

const interval = [];
const PING_HOST = "8.8.8.8";
const PING_INTERVAL = 3600000; // 1 hour
const MAX_HEALTH = 100;
const MAX_LOVE = 100;
const MAX_HUNGER = 100;
const MAX_ATTENTION = 100;

// Ping function
async function pingHost() {
    try {
        const res = await ping.promise.probe(PING_HOST);
        return res.time;
    } catch (e) {
        console.error("Error en ping:", e);
        return null;
    }
}

async function pingServer() {
    return await pingHost();
}

(async () => {
    const serverMs = await pingServer();
    if (serverMs !== null) {
        console.log("Tiempo de respuesta del servidor: ", serverMs, " ms");
    }
})();

// Get memory stats function
function getMemoryStats() {
    const totalMemory = os.totalmem() / 1e9; // Convert to GB
    const totalFreeMemory = os.freemem() / 1e9; // Convert to GB
    const totalUsedMemory = (os.totalmem() - os.freemem()) / 1e9; // Convert to GB
    return {
        total: totalMemory.toFixed(2),
        free: totalFreeMemory.toFixed(2),
        used: totalUsedMemory.toFixed(2),
    };
}

// Get machine stats function
function getMachineStats() {
    return {
        cpu: "Intel Core 2 Duo T6600 2.2GHZ",
        os: "Windows 7",
        arc: "x86 (32bit)",
    };
}

// Function to write to database (improved error handling)
function writeDB() {
    try {
        writeFile("db.json", JSON.stringify(db, null, 2), "utf8");
        console.log("Database written successfully.")
    }catch(err){
        console.error("Database written error.")
    }
}

// Initialize database (uses async/await for clarity)
async function dbInit(id, obj) {
    if (!db[id]) {
        db[id] = { eco: {} };
    }
    if (db[id].eco[obj] === undefined) {
        db[id].eco[obj] = 0;
    }
    await writeDB();
}

// Train command
async function trainPet(msg) {
    let mood = await eco.Read(msg.from.id, "mood");
    let health = await eco.Read(msg.from.id, "health");
    mood += 10; // Increase mood
    health += 5; // Increase health
    await eco.Set(msg.from.id, "mood", mood);
    await eco.Set(msg.from.id, "health", health);
    await bot.sendMessage(msg.chat.id, "Your pet has been trained! Mood and health improved.");
}

// Rename command
async function renamePet(msg) {
    const newName = msg.text.split(" ").slice(1).join(" ");
    if (newName) {
        await eco.Set(msg.from.id, "petName", newName);
        await bot.sendMessage(msg.chat.id, `Your pet has been renamed to ${newName}!`);
    } else {
        await bot.sendMessage(msg.chat.id, "Please provide a name to rename your pet.");
    }
}

// Economy functions (using async/await for write operations)
const eco = {
    Read: async (id, obj) => {
        await dbInit(id, obj);
        return db[id].eco[obj];
    },
    Add: async (id, obj, value) => {
        await dbInit(id, obj);
        db[id].eco[obj] += value;
        await writeDB();
    },
    Set: async (id, obj, value) => {
        await dbInit(id, obj);
        db[id].eco[obj] = value;
        await writeDB();
    },
};

// Build function (improves readability)
async function build() {
    if (!db["1"]) {
        db["1"] = { build: 1, date: Date.now() };
    } else {
        db["1"].build += 1;
    }
    await writeDB();
}

build();


// Function to determine mood based on attention and love
function determineMood(attention, love) {
    if (attention > 70 && love > 70) {
        return "happy";
    } else if (love > 50 && attention < 30) {
        return "sad";
    } else if (love < 30 && attention < 30) {
        return "unhappy";
    } else if (attention > 50) {
        return "content";
    } else {
        return "neutral";
    }
}

// Function to determine health status based on health and mood
function determineHealthStatus(health, mood) {
    if (health < 30) {
        return "sick";
    } else if (mood === "unhappy") {
        return "unwell";
    } else {
        return "healthy";
    }
}

// Function to determine status based on hunger, health, and mood
function determineStatus(hunger, health, mood) {
    if (hunger > 70 && health < 30) {
        return "starving";
    } else if (health < 50) {
        return "weak";
    } else if (mood === "happy") {
        return "thriving";
    } else {
        return "normal";
    }
}

async function pet(msg) {
    let mood = await eco.Read(msg.from.id, "mood");
    let status = await eco.Read(msg.from.id, "status");
    let love = await eco.Read(msg.from.id, "love");
    let attention = await eco.Read(msg.from.id, "attention");
    let hunger = await eco.Read(msg.from.id, "hunger");
    let health = await eco.Read(msg.from.id, "health");

    if (mood === 0) { // Default values if mood is 0
        mood = "unhappy";
        status = "scared";
        love = 10;
        hunger = 10;
        health = 90;
    }

    let lastConnection = await eco.Read(msg.from.id, "lastConnection");
    let currentTime = Date.now();

    if (lastConnection === 0) { // Initialize last connection time
        lastConnection = currentTime;
        await eco.Set(msg.from.id, "lastConnection", lastConnection);
    }

    const minutesPassed = Math.floor((currentTime - lastConnection) / (1000 * 60));
    if (minutesPassed >= 1) { // Update pet stats based on time passed
        const periods = (minutesPassed / 60).toFixed(1);
        love -= periods * 1;
        hunger += periods * 10;
        health -= periods * 3;
        attention -= periods * 7;
    }

    love = Math.max(0, love);
    hunger = Math.max(0, hunger);
    health = Math.max(0, health);
    attention = Math.max(0, attention);

    love = Math.min(MAX_LOVE, love);
    hunger = Math.min(MAX_HUNGER, hunger);
    health = Math.min(MAX_HEALTH, health);
    attention = Math.min(MAX_ATTENTION, attention);

    love = parseFloat(love);
    hunger = parseFloat(hunger);
    health = parseFloat(health);
    attention = parseFloat(attention);
    mood = determineMood(attention, love);

    status = determineStatus(hunger, health, mood);

    status = determineHealthStatus(health, mood);

    await eco.Set(msg.from.id, "mood", mood);
    await eco.Set(msg.from.id, "status", status);
    await eco.Set(msg.from.id, "love", love);
    await eco.Set(msg.from.id, "hunger", hunger);
    await eco.Set(msg.from.id, "health", health);
    await eco.Set(msg.from.id, "attention", attention);

    lastConnection = Date.now();
    eco.Set(msg.from.id, "lastConnection", lastConnection);
}

const bot = new TelegramBot(token, { polling: true });

console.log("Hosting Now");

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        "Welcome, this is a \"simple\" entertainment bot, we are currently improving our service.\n" +
        "You are given a virtual pet that you must take care of and teach so that it can keep you company..." +
        " Using the bot is simple; you can use the /help commands or the .help commands for your convenience."
    );
});

bot.onText(/\/train/, async (msg) => {
    await trainPet(msg);
});

bot.onText(/\/rename/, async (msg) => {
    await renamePet(msg);
});

bot.on("message", async (msg) => {
    if (msg.text) {
        let text = msg.text;
        switch (true) {
            case text.includes('baka') || text.includes('idiot') || text.includes('stupid') || text.includes('fuck'):
                await bot.deleteMessage(msg.chat.id, msg.message_id)
                break;
            case text.startsWith('/vote') || text.startsWith('.vote'):
                await bot.sendMessage(
                    msg.chat.id,
                    "Vote for the bot, and help it reach more people, we currently have no way of knowing if you did it or not, settle for a good cause " +
                    "[Vote](https://t.me/dailychannelsbot?start=tamagochi_neko_bot)", { parse_mode: "MarkdownV2" });
                break;
            case text.startsWith('/work') || text.startsWith('.work'):
                pet(msg);
                let gain = Math.floor(Math.random() * 100) + 100 * await eco.Read(msg.from.id, "job");
                let experience = Math.floor(gain / 2);
                await bot.sendMessage(msg.chat.id, "You've worked and earned: " + gain + "\n" +
                    "Your profession rank is: " + (await eco.Read(msg.from.id, "job")));
                await eco.Add(msg.from.id, "money", gain);
                await eco.Add(msg.from.id, "experience", experience);
                break;
            case text.startsWith('/stoptowork' || text.startsWith('.stoptowork')):
                pet(msg);
                await bot.sendMessage(msg.chat.id, "You've called your pet back from work.");
                clearInterval(interval[msg.from.id]);
                break;
            case text.startsWith('/ping') || text.startsWith('.ping'):
                let latencyStart = Date.now();
                await (async () => {
                    let serverMs = await pingServer();
                    if (serverMs !== null) {
                        await bot.sendMessage(msg.chat.id, "connection: " + serverMs + " ms\nReply: " + (Date.now() - latencyStart) + " ms");
                    }
                })();
                break;
            case text.startsWith('/sendtowork') || text.startsWith('.sendtowork'):
                pet(msg);
                await bot.sendMessage(msg.chat.id, "You've sent your pet to work. It will return in 1 hour.");
                interval[msg.from.id] = setInterval(() => {
                    let gain = Math.floor(Math.random() * 100) + 100 * eco.Read(msg.from.id, "job");
                    bot.sendMessage(msg.chat.id, "Your pet has returned from work!");
                    eco.Add(msg.from.id, "money", gain);
                }, 3600000);
                break;
            case text.startsWith('/help') || text.startsWith('.help'):
                await bot.sendMessage(msg.chat.id,
                    "Command Guide" +
                    "```Economy\n" +
                    ".daily: Get Your daily bonus!\n" +
                    ".work: Find temporary work\n" +
                    ".sendtowork: Send your pet on a job\n" +
                    ".stoptowork: Get your pet to quit its job\n" +
                    ".cvupgrade: Improve your CV for better jobs\n" +
                    ".balance: Check your bank account\n" +
                    "\n```" +
                    "```Pet\n" +
                    ".pet: See your pet's status\n" +
                    ".feed: Keep your pet happy with some food!\n" +
                    ".pat: show your pet some love (might improve its mood)\n" +
                    ".heal: Make your pet feel better if it's feeling down\n" +
                    ".setpetimage: Give your pet a new profile picture!\n" +
                    "\n```" +
                    "```Information\n" +
                    ".help: Need more help? This command will guide you.\n" +
                    ".info: Learn more about the bot\n" +
                    ".contact: Report any issues or suggest new features!\n" +
                    ".ping: Check the bot's response time.\n" +
                    ".vote: Support the bot by voting for it!" +
                    "\n```" +
                    "```Note: The bot is still in Beta\n``` [Official Server Support](https://t.me/TamagochiBotOfficialGroup)",
                    { parse_mode: "MarkdownV2" }
                );
                break;
            case text.startsWith('/info') || text.startsWith('.info'):
                let builds = db["1"].build;
                let lastBuild = db["1"].date;
                const memoryStats = getMemoryStats();
                const machineStats = getMachineStats();
                await bot.sendMessage(
                    msg.chat.id,
                    "*Server Stats*" +
                    "```Machine\n" +
                    machineStats.os +
                    "\n" +
                    machineStats.cpu +
                    "\n```" +
                    "```Memory(DDR2):\n" +
                    "Total memory:" +
                    memoryStats.total +
                    "GB\n" +
                    "Memory Used:" +
                    memoryStats.used +
                    "GB\n" +
                    "Memory free:" +
                    memoryStats.free +
                    "GB\n```" +
                    "```\"WebStorm(2020.2.4)\n" +
                    "build : " +
                    builds +
                    "\nLast run : " +
                    new Date(lastBuild).toString() +
                    "\n```" +
                    "```NodeJs(13.14.0)\n" +
                    "node-telegram-bot-api: 0.66.0\n" +
                    "fs\n" +
                    "os\n" +
                    "\n```"
                    ,
                    { parse_mode: "MarkdownV2" });
                break;
            case text.startsWith('/cvupgrade') || text.startsWith('.cvupgrade'):
                let cost = (await eco.Read(msg.from.id, "job") + await eco.Read(msg.from.id, "job")) * 1000;
                if (await eco.Read(msg.from.id, "money") < cost) {
                    await bot.sendMessage(msg.chat.id, `They can't improve your CV without a budget\n ${cost}`);
                } else {
                    await bot.sendMessage(msg.chat.id, `We have improved your CV, you will have better job offers`);
                    await eco.Add(msg.from.id, "money", -cost);
                    await eco.Add(msg.from.id, "job", +1);
                }
                break;
            case text.startsWith('/daily') || text.startsWith('.daily'):
                let d = new Date();
                let date = d.getDate();
                let day = d.getDay();
                let gainfully;
                if (day === 6 || day === 0) gainfully = (2000 * (await eco.Read(msg.from.id, "job") + 1)) * 2;
                if (day !== 6 || day !== 0) gainfully = 2000 * (await eco.Read(msg.from.id, "job") + 1);
                if (await eco.Read(msg.from.id, "daily") !== date) {
                    await bot.sendMessage(msg.chat.id, `You have receive ${gainfully} for your daily bonus\non Saturday and Sunday you get double the bonus...`);
                    await eco.Add(msg.from.id, "money", gainfully);
                    await eco.Set(msg.from.id, "daily", date);
                } else {
                    await bot.sendMessage(
                        msg.chat.id,
                        `Wait 1 day to claim your daily bonus`,
                    );
                }
                break;
            case text.startsWith('/balance') || text.startsWith('.balance'):
                await bot.sendMessage(msg.chat.id, "bank : " + (await eco.Read(msg.from.id, "money")));
                break;
            case text.startsWith('/pet') || text.startsWith('.pet'):
                pet(msg);
                let mood = await eco.Read(msg.from.id, "mood");
                let status = await eco.Read(msg.from.id, "status");
                let health = await eco.Read(msg.from.id, "health");
                let hunger = await eco.Read(msg.from.id, "hunger");
                let love = await eco.Read(msg.from.id, "love");
                let attention = await eco.Read(msg.from.id, "attention");
                let petImage = await eco.Read(msg.from.id, "petImage");
                await bot.sendPhoto(msg.chat.id, petImage, {
                    quality: 100,
                    witdh: 400
                });
                await bot.sendMessage(msg.chat.id,
                    "Status and statistics of your virtual pet:\n" +
                    "```Name: " + (await eco.Read(msg.from.id, "petName") || "Unnamed") + "\n" +
                    "```mood\n" +
                    mood + " | " + status +
                    "```" +
                    "```emotions\n" +
                    "love: " + love + "%\n" +
                    "attention: " + attention + "%\n" +
                    "```" +
                    "```Food\n" +
                    "hunger: " + hunger + "%\n" +
                    "```" +
                    "```health\n" +
                    health + "%```",
                    { parse_mode: "MarkdownV2" });
                break;
            case text.startsWith('/contact') || text.startsWith('.contact'):
                await bot.sendMessage(msg.chat.id, "Contact: @FAFSDJ (please don't spam me :c, I don't speak English)");
                break;
            case text.startsWith('/cmd') || text.startsWith('.cmd'):
                if (msg.from.id === 5172297696) {
                    try {
                        let command = text.replace('/cmd', "");
                        let command1 = command.replace('.cmd', "")
                        let command2 = command1.replace("```", "");
                        eval(command2);
                    } catch (e) {
                        await bot.sendMessage(msg.chat.id, "Error en ejecución: " + e);
                    }
                } else {
                    await bot.sendMessage(msg.chat.id, "esta funcion es solo para el administrador")
                }
                break;
            case text.startsWith('/pat') || text.startsWith('.pat'):
                pet(msg);
                await bot.sendMessage(msg.chat.id, "You stroke your pet's head; it seems to like it a little.");
                await eco.Add(msg.from.id, "love", 0.2);
                await eco.Add(msg.from.id, "attention", 10);
                break;
            case text.startsWith('/feed') || text.startsWith('.feed'):
                pet(msg);
                await bot.sendMessage(msg.chat.id, "You cook something to eat for your pet; at least it doesn't taste bad.");
                await eco.Add(msg.from.id, "love", 0.1);
                await eco.Add(msg.from.id, "hunger", (-40));
                break;
            case text.startsWith('/heal') || text.startsWith('.heal'):
                pet(msg);
                await bot.sendMessage(msg.chat.id, "You check your pet to see that it has nothing wrong...");
                await eco.Add(msg.from.id, "love", 0.3);
                await eco.Add(msg.from.id, "health", 30);
                break;
            case text.startsWith('/setpetimage') || text.startsWith('.setpetimage'):
                await bot.sendMessage(msg.chat.id, "Send a photo to assign it as a pet photo (the photo will be uploaded to imgur anonymously, according to... I think... I didn't read the documentation well XD) so that it can be used.");
                await eco.Set(msg.from.id, "setImage", 1);
                break;
        }
    } else {
        if (await eco.Read(msg.from.id, "setImage") === 1) {
            if (msg.photo) {
                var photo = msg.photo[0].file_id;
                bot.getFileLink(photo).then(function (enlace) {
                    console.log(enlace);
                    var clientId = '6c1508253231618';
                    imgur.setClientID(clientId);
                    imgur.upload(enlace, function (err, res) {
                        if (err) {
                            console.error(err);
                            return;
                        }
                        console.log(res.data.link);
                        var link = res.data.link;
                        console.log("XD")
                        bot.sendMessage(msg.chat.id, "Enlace: " + link);
                        eco.Set(msg.from.id, "petImage", link);
                        eco.Set(msg.from.id, "setImage", 0);
                    });
                }).catch(function (err) {
                    console.error(err);
                });
            }
        }
    }
});
