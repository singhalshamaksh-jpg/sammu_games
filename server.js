const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { maxHttpBufferSize: 5e6 });
const path = require('path');

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

io.engine.pingTimeout = 60000;
io.engine.pingInterval = 25000;

let players = [];
let hostId = null;
let hostUsername = null;
let sessionMemory = {};
let bannedUsers = new Set();
let bannedDevices = new Set();
let bannedRealIPs = new Set();

let drawTimer = null, bombTimer = null, memoryTimer = null;
let simonTimer = null, stkInterval = null;
let spinnerEnded = false;

const ADMIN_SECRET_KEY = "#bhaicharaontop";

const VIP_WHITELIST = new Set([
    "sammu", "heer", "advait", "milly", "zoro",
    "izzan", "sus", "noob", "moon", "sid",
    "sarah", "neha", "ruwii", "saeron", "samaksh"
]);

function isWhitelisted(username) {
    if (!username) return false;
    const clean = username.toLowerCase().trim();
    return VIP_WHITELIST.has(clean) || (hostUsername && clean === hostUsername.toLowerCase().trim());
}
let botMemory = {
    lastWinner: null,
    winStreaks: {},
    playerPoints: {},
    trophies: {},
    activeQuiz: null,
    activeRiddle: null,
    activeTask: null,
    customTask: null,
    legendaryGallery: [],
    chatCount: 0
};

const gifLibrary = {
    fire: "🔥|ON FIRE!|pulse", gg: "🎉|GOOD GAME!|bounce", cry: "😭|CRYING HARD|shake",
    dance: "💃|VICTORY DANCE|spin", win: "🏆|CHAMPION!|bounce", clown: "🤡|CLOWN MOMENT|shake",
    sus: "👀|VERY SUS...|pulse", hype: "⚡|MAX HYPE!|bounce", savage: "😎|THUG LIFE SAVAGE|pulse",
    bye: "👋|BYE BYE!|shake", roast: "🧯|EMOTIONAL DAMAGE|shake", noob: "💀|TOTAL NOOB|spin",
    laugh: "😂|LMAOOO!|bounce", shock: "😱|WHAT?!|shake", love: "❤️|MUCH LOVE!|pulse",
    bro: "🤜|MY BRO!|bounce", chad: "🗿|GIGA CHAD|pulse", sigma: "🐺|SIGMA RULE|pulse",
    rip: "🪦|REST IN PEACE|shake", boom: "💥|KABOOM!|pulse", goat: "🐐|THE G.O.A.T|bounce",
    king: "👑|BOW TO THE KING|bounce", queen: "👸|SLAY QUEEN|bounce", flex: "💪|WEIRD FLEX|pulse",
    sleep: "😴|BORING... ZZZ|shake", hungry: "🍔|NEED FOOD NOW|bounce", party: "🥳|PARTY TIME!|spin",
    rich: "💸|PAISA HI PAISA|bounce", fast: "🏎️|TOO FAST!|pulse", slow: "🐢|SOOO SLOW|shake",
    brain: "🧠|BIG BRAIN TIME|pulse", dumb: "🤪|ZERO IQ MOMENT|spin", angry: "🤬|RAGE MODE!|shake",
    cool: "🧊|ICE COLD|pulse", facepalm: "🤦|BRO REALLY?!|shake", salute: "🫡|RESPECT!|bounce",
    magic: "🪄|PURE MAGIC|spin", ghost: "👻|BOO! GHOSTED|pulse", ninja: "🥷|STEALTH NINJA|spin",
    alien: "👽|OUT OF THIS WORLD|spin", lion: "🦁|KING OF JUNGLE|pulse", robot: "🤖|BEEP BOOP AI|bounce",
    pizza: "🍕|PIZZA PARTY|spin", trophy: "🏅|MVP WINNER|bounce", rocket: "🚀|TO THE MOON!|bounce",
    heart: "💖|DIL SE LOVE|pulse", star: "🌟|SUPERSTAR!|spin", lightning: "⚡|THUNDER STRIKE|pulse",
    peace: "✌️|PEACE OUT!|bounce", hello: "👋|NAMASTE BRO!|bounce"
};
const quizBank = [
    { q: "🌍 GEOGRAPHY: Which country has the largest population in the world?", a: "india" },
    { q: "⚡ SCIENCE: What is the chemical symbol for Gold?", a: "au" },
    { q: "🎮 GAMING: Which block-building game features Creepers and Ender Dragons?", a: "minecraft" },
    { q: "🏏 CRICKET: Who is known as the 'God of Cricket'?", a: "sachin" },
    { q: "🚀 SPACE: Which planet is known as the Red Planet?", a: "mars" },
    { q: "🌊 OCEAN: What is the largest ocean on Earth?", a: "pacific" },
    { q: "🦁 ANIMALS: What is the fastest land animal?", a: "cheetah" },
    { q: "🏛️ HISTORY: In which country are the Pyramids of Giza located?", a: "egypt" },
    { q: "💻 TECH: Who founded Microsoft?", a: "bill gates" },
    { q: "⚽ FOOTBALL: Which country won the 2022 FIFA World Cup?", a: "argentina" },
    { q: "🧪 SCIENCE: What gas do plants absorb from the atmosphere?", a: "carbon dioxide" },
    { q: "🎬 MOVIES: Who played Iron Man in the Marvel movies?", a: "robert downey" },
    { q: "🏔️ GEOGRAPHY: What is the tallest mountain in the world?", a: "everest" },
    { q: "🎵 MUSIC: How many strings does a standard guitar have?", a: "6" },
    { q: "🍕 FOOD: Which country invented Pizza?", a: "italy" },
    { q: "🦴 BIOLOGY: How many bones are in an adult human body?", a: "206" },
    { q: "🌌 SPACE: What is the closest star to Earth?", a: "sun" },
    { q: "♟️ GAMES: How many squares are on a standard chessboard?", a: "64" },
    { q: "🇮🇳 INDIA: What is the capital city of India?", a: "new delhi" },
    { q: "⚡ SCIENCE: What is H2O commonly known as?", a: "water" },
    { q: "🏏 IPL: Which IPL team is known as the 'Yellow Army'?", a: "csk" },
    { q: "🌍 GEOGRAPHY: Which is the longest river in the world?", a: "nile" },
    { q: "🎬 BOLLYWOOD: Who is known as the 'King Khan' of Bollywood?", a: "shah rukh khan" },
    { q: "⚡ TECH: What does 'CPU' stand for in a computer?", a: "central processing unit" },
    { q: "🪐 SPACE: Which planet in our solar system has the most prominent rings?", a: "saturn" },
    { q: "🏏 CRICKET: Who is nicknamed 'Captain Cool' in Indian cricket?", a: "dhoni" },
    { q: "🌍 GEOGRAPHY: Which is the largest desert in the world?", a: "sahara" },
    { q: "🦸 MARVEL: What is Thor's enchanted hammer called?", a: "mjolnir" },
    { q: "🎮 GAMING: In which battle royale game do players drop onto Erangel?", a: "bgmi" },
    { q: "🧪 SCIENCE: What is the hardest natural substance on Earth?", a: "diamond" },
    { q: "🇮🇳 INDIA: Which city is known as the 'Pink City' of India?", a: "jaipur" },
    { q: "⚽ FOOTBALL: Which player is famously known as 'CR7'?", a: "ronaldo" },
    { q: "🚀 SPACE: Who was the first person to walk on the Moon?", a: "neil armstrong" },
    { q: "🦁 ANIMALS: Which is the largest mammal on Earth?", a: "blue whale" },
    { q: "💻 TECH: Which company makes the iPhone?", a: "apple" },
    { q: "🎬 BOLLYWOOD: Which movie features the iconic character 'Gabbar Singh'?", a: "sholay" },
    { q: "🌍 GEOGRAPHY: Which country is known as the Land of the Rising Sun?", a: "japan" },
    { q: "⚡ SCIENCE: What planet is closest to the Sun?", a: "mercury" },
    { q: "🏏 CRICKET: How many players are on a cricket team on the field?", a: "11" },
    { q: "🎵 MUSIC: Who sang the global hit 'Shape of You'?", a: "ed sheeran" },
    { q: "🇮🇳 INDIA: Which monument in Agra is one of the Seven Wonders of the World?", a: "taj mahal" },
    { q: "🎮 GAMING: What is the name of Mario's brother in Nintendo games?", a: "luigi" },
    { q: "🧪 SCIENCE: Which vitamin do we get mainly from sunlight?", a: "vitamin d" },
    { q: "🌍 GEOGRAPHY: Which is the smallest country in the world by area?", a: "vatican city" },
    { q: "⚽ FOOTBALL: How many minutes are in a standard football match?", a: "90" },
    { q: "🎬 MOVIES: Who directed the movie 'Inception' and 'Oppenheimer'?", a: "christopher nolan" },
    { q: "🦁 ANIMALS: How many legs does a spider have?", a: "8" },
    { q: "🇮🇳 INDIA: Which river is considered the holiest river in India?", a: "ganga" },
    { q: "⚡ TECH: What does 'Wi-Fi' help devices connect to wirelessly?", a: "internet" },
    { q: "🪐 SPACE: How many planets are in our solar system?", a: "8" }
];
const riddleBank = [
    { q: "❓ RIDDLE: What has keys but can't open locks?", a: "piano" },
    { q: "❓ RIDDLE: The more of me you take, the more you leave behind. What am I?", a: "footsteps" },
    { q: "❓ RIDDLE: What gets wetter the more it dries?", a: "towel" },
    { q: "❓ RIDDLE: What has hands but cannot clap?", a: "clock" },
    { q: "❓ RIDDLE: What has to be broken before you can use it?", a: "egg" },
    { q: "❓ RIDDLE: I'm tall when I'm young, and I'm short when I'm old. What am I?", a: "candle" },
    { q: "❓ RIDDLE: What is full of holes but still holds water?", a: "sponge" },
    { q: "❓ RIDDLE: What goes up but never comes down?", a: "age" },
    { q: "❓ RIDDLE: What has one eye but can't see?", a: "needle" },
    { q: "❓ RIDDLE: What has many teeth but cannot bite?", a: "comb" },
    { q: "❓ RIDDLE: What has legs but doesn't walk?", a: "table" },
    { q: "❓ RIDDLE: What can you catch but never throw?", a: "cold" },
    { q: "❓ RIDDLE: What belongs to you, but other people use it more than you?", a: "name" },
    { q: "❓ RIDDLE: What has a neck without a head?", a: "bottle" },
    { q: "❓ RIDDLE: What travels around the world while staying in a corner?", a: "stamp" },
    { q: "❓ RIDDLE: What gets bigger the more you take away from it?", a: "hole" },
    { q: "❓ RIDDLE: What has words, but never speaks?", a: "book" },
    { q: "❓ RIDDLE: What runs all around a backyard, yet never moves?", a: "fence" },
    { q: "❓ RIDDLE: What has a thumb and four fingers, but is not alive?", a: "glove" },
    { q: "❓ RIDDLE: What can fill a room but takes up no space?", a: "light" },
    { q: "❓ RIDDLE: What is always in front of you but can't be seen?", a: "future" },
    { q: "❓ RIDDLE: What goes through cities and fields, but never moves?", a: "road" },
    { q: "❓ RIDDLE: I have branches, but no fruit, trunk, or leaves. What am I?", a: "bank" },
    { q: "❓ RIDDLE: What can you break, even if you never pick it up or touch it?", a: "promise" },
    { q: "❓ RIDDLE: What has a head and a tail, but no body?", a: "coin" },
    { q: "❓ RIDDLE: What building has the most stories?", a: "library" },
    { q: "❓ RIDDLE: What can travel faster than anything else in the universe?", a: "light" },
    { q: "❓ RIDDLE: What begins with T, ends with T, and has T in it?", a: "teapot" },
    { q: "❓ RIDDLE: What is black when it is clean and white when it is dirty?", a: "blackboard" },
    { q: "❓ RIDDLE: I speak without a mouth and hear without ears. What am I?", a: "echo" },
    { q: "❓ RIDDLE: What has 88 keys, but cannot open a single door?", a: "piano" },
    { q: "❓ RIDDLE: What has a bottom at the top?", a: "legs" },
    { q: "❓ RIDDLE: What goes up when rain comes down?", a: "umbrella" },
    { q: "❓ RIDDLE: What is full of keys but opens no doors?", a: "keyboard" },
    { q: "❓ RIDDLE: What has a face and two hands, but no arms or legs?", a: "clock" },
    { q: "❓ RIDDLE: What kind of band never plays music?", a: "rubber band" },
    { q: "❓ RIDDLE: What has many rings, but no fingers?", a: "telephone" },
    { q: "❓ RIDDLE: What can you hold in your left hand, but never in your right hand?", a: "right elbow" },
    { q: "❓ RIDDLE: What gets sharper the more you use it?", a: "brain" },
    { q: "❓ RIDDLE: Where does today come before yesterday?", a: "dictionary" }
];
const validDictionary = {
    animals_c: ["cat","cow","cheetah","camel","crocodile","crab","crow","chimpanzee","chameleon","cobra","cougar","coyote","crane","cricket","chicken"],
    countries_a: ["australia","argentina","afghanistan","algeria","angola","armenia","austria","azerbaijan","albania","andorra"],
    countries_i: ["india","italy","indonesia","iran","iraq","ireland","israel","iceland"],
    animals_b: ["bear","bat","buffalo","baboon","badger","beaver","bee","beetle","bison","boar","butterfly","bull"],
    fruits_m: ["mango","melon","mulberry","mandarin","mangosteen"],
    fruits_p: ["papaya","pineapple","peach","pear","plum","pomegranate","passionfruit","persimmon"],
    colors_b: ["blue","black","brown","beige","bronze","burgundy","maroon"],
    cities_d: ["delhi","dubai","dallas","denver","dhaka","doha","dublin","dehradun","durgapur"],
    cities_m: ["mumbai","madrid","moscow","melbourne","miami","manila","montreal","munich","mysore","meerut"],
    names_r: ["rahul","rohan","rohit","ravi","raj","riya","rashmi","ritika","ranveer","ranbir","ramesh","rajesh","rekha","radha"]
};

const botTasks = [
    { text: "⚡ TASK: Name 3 ANIMALS starting with letter C! (e.g., Cat, Cow, Cheetah)", letter: "c", count: 3, dict: "animals_c" },
    { text: "⚡ TASK: Name 4 COUNTRIES starting with letter A! (Separate with commas or spaces)", letter: "a", count: 4, dict: "countries_a" },
    { text: "⚡ TASK: Name 4 COUNTRIES starting with letter I!", letter: "i", count: 4, dict: "countries_i" },
    { text: "⚡ TASK: Name 3 ANIMALS starting with letter B!", letter: "b", count: 3, dict: "animals_b" },
    { text: "⚡ TASK: Name 3 FRUITS starting with letter M!", letter: "m", count: 3, dict: "fruits_m" },
    { text: "⚡ TASK: Name 3 FRUITS starting with letter P!", letter: "p", count: 3, dict: "fruits_p" },
    { text: "⚡ TASK: Name 4 COLORS starting with letter B!", letter: "b", count: 4, dict: "colors_b" },
    { text: "⚡ TASK: Name 3 CITIES starting with letter D!", letter: "d", count: 3, dict: "cities_d" },
    { text: "⚡ TASK: Name 3 CITIES starting with letter M!", letter: "m", count: 3, dict: "cities_m" },
    { text: "⚡ TASK: Name 5 MOBILE APPS you use! (Any letters, separate with commas/spaces)", letter: null, count: 5 },
    { text: "⚡ TASK: Name 4 ACTORS or ACTRESSES! (Any letters, separate with commas/spaces)", letter: null, count: 4 },
    { text: "⚡ TASK: Name 4 CRICKETERS or FOOTBALLERS! (Any letters)", letter: null, count: 4 },
    { text: "⚡ TASK: Name 4 MOVIES or WEB SERIES! (Any letters)", letter: null, count: 4 },
    { text: "⚡ TASK: Name 4 FOODS or SNACKS! (Any letters)", letter: null, count: 4 },
    { text: "⚡ TASK: Name 4 BOYS or GIRLS NAMES starting with letter R!", letter: "r", count: 4, dict: "names_r" }
];

const songWords = [
    "dupatta", "chanda", "baarish", "dil", "naina", "ishq", "pyaar", "mohabbat", "raat", "sapna",
    "zindagi", "dosti", "yaari", "sawan", "badal", "sitare", "aasmaan", "duniya", "khuda", "rab",
    "sanam", "mehboob", "jaanu", "deewana", "mast", "junoon", "nasha", "khamoshi", "muskurahat", "aankhein",
    "hawa", "khushboo", "phool", "gulab", "rang", "holi", "diwali", "shaadi", "mehndi", "choodi",
    "payal", "bindiya", "kajal", "zulf", "chehra", "dharkan", "saans", "dard", "intezar", "alvida"
];

songWords.forEach(word => {
    botTasks.push({
        text: `🎵 SONG TASK: Type lyrics/name of a Hindi/Bollywood song containing the word **"${word.toUpperCase()}"**! (Minimum 3 words)`,
        songKeyword: word
    });
});
const roastBank = [
    "bro plays like his Wi-Fi is running on a potato! 🥔📶",
    "even a blindfolded bot has better reflexes than you! 💀",
    "bro talks big in chat and loses in 2 seconds flat! 🤡",
    "is proof that participation trophies exist! 🏅😂",
    "needs a tutorial just to press the TAP button! 🔥",
    "tereko dekh ke lagta hai keyboard bhi sharma gaya! 😭⌨️",
    "has the reaction speed of a sleepy tortoise! 🐢💤",
    "bro's gameplay should come with a comedy warning label! ⚠️😂",
    "even Internet Explorer loads faster than your brain in Math Blitz! 🧠🐌",
    "is carrying the whole enemy team to victory! 🏆🤡",
    "bhai tu game khel raha hai ya sightseeing kar raha hai? 👀🤣",
    "missed the target so bad even the wall felt sorry! 🎯💀",
    "bro's strategy is 100% panic and 0% skill! 🔥😅",
    "types slower than my grandma on a Nokia 3310! 📱👴",
    "if losing was an Olympic sport, you'd have 10 gold medals! 🥇🤡",
    "bhai thoda paani pi le, itna jaldi kaun out hota hai? 💧😂",
    "brought a wooden spoon to a laser fight! 🥄⚡",
    "even the Bomb Pass timer felt bad exploding on you! 💣😭",
    "bro's Wi-Fi ping is higher than his IQ score! 📶🤪",
    "is the reason Sammu's Bot added a 'Noob' GIF! 💀🎬",
    "bhai tu Captain mat ban, team wale resign kar denge! 🚩😂",
    "got outplayed by a random number generator! 🎲🤡",
    "plays like he's using his elbows instead of thumbs! 💪🤣",
    "bro's comeback is still buffering at 1%... 🔄💀",
    "should stick to watching from the spectator bench! 🪑🔥",
    "bhai itna confidence kahan se laate ho haarne ke baad bhi? 😎😂",
    "makes every 1v1 look like a charity donation! 💸🤡",
    "couldn't find the Diamond even with X-Ray vision! 💎👀",
    "bro's thumbs went on vacation mid-match! 🏖️💀",
    "is officially the CEO of Choking at the Last Second! 🏆😭",
    "bhai tere se fast toh snail marathon bhaag leta hai! 🐌🏃",
    "has 99 problems and winning a match isn't one of them! 📉😂",
    "fell for the Color Trap even when the answer was written on screen! 🎨🤡",
    "bhai tu practice mode mein bhi bot se haar jayega! 🤖💀",
    "pressed the wrong wire in Bomb Defusal on purpose just to leave early! ✂️💥",
    "types with one finger like he's defusing a real nuclear bomb! ☝️😅",
    "bhai teri kismat aur tere reflexes dono off-duty hain aaj! 🛌🤣",
    "got caught by the Killer in 3 seconds flat! 🔪🏃‍♂️",
    "is the only player who can lose a single-player Drawing Pad session! 🎨😭",
    "bhai retire ho ja, lobby ke baaki log bhi hass rahe hain! 👏😂"
];

const truthBank = [
    "TRUTH: Who in this lobby do you think is the easiest to beat? 👀",
    "TRUTH: What is the funniest excuse you ever gave after losing a game? 😂",
    "TRUTH: Have you ever rage-quit a game before? Be honest! 💀",
    "TRUTH: Who is your favorite teammate in this room right now? 🤝",
    "TRUTH: Which mini-game are you secretly the worst at? 🤡",
    "TRUTH: Have you ever blamed 'lag' when you actually just missed? 📶😂",
    "TRUTH: Who in this chat talks the most trash before losing? 🔥",
    "TRUTH: If you could ban one person in this room for 5 minutes just for fun, who would it be? 🔨👀",
    "TRUTH: What is the most embarrassing song you secretly love listening to? 🎵😳",
    "TRUTH: Have you ever copied someone else's answer during !task or !quiz? 🧠😅",
    "TRUTH: Who in this lobby would survive the longest in a real zombie apocalypse? 🧟",
    "TRUTH: Who in this room would get caught FIRST in Survive the Killer? 🔪😂",
    "TRUTH: What is your weirdest habit while gaming on your phone? 📱",
    "TRUTH: Have you ever pretended your battery was dying to leave a losing match? 🪫💀",
    "TRUTH: Who is the funniest person in this lobby right now? 😂",
    "TRUTH: Which player here do you never want as your opposing Captain? ⚔️",
    "TRUTH: Have you ever laughed so hard at a roast in chat that you dropped your phone? 🤣",
    "TRUTH: What is one secret talent you have that nobody in this lobby knows about? 🌟",
    "TRUTH: If you had to swap avatars with someone here, whose would you pick? 🥷",
    "TRUTH: Have you ever cheated in rock-paper-scissors in real life? 🪨📄✂️",
    "TRUTH: Who in this lobby takes mini-games way too seriously? 🏆😅",
    "TRUTH: What is the longest winning streak you've ever had in any game? 🔥",
    "TRUTH: Have you ever accidentally sent a message to the wrong chat? 💬😱",
    "TRUTH: Who is the best Captain in Sammu Games right now? 👑",
    "TRUTH: Be honest—did you use a calculator during Math Blitz? 🧮👀"
];

const dareBank = [
    "DARE: Send '/gif clown' in chat and type 'I am the lobby noob'! 🤡",
    "DARE: Type the next 3 chat messages in ALL CAPS! 📢",
    "DARE: Hype up the opposite team captain in chat right now! 🔥",
    "DARE: Challenge anyone in the room to a 1v1 in the next arena! ⚔️",
    "DARE: Send '/gif dance' and praise Sammu's Bot in chat! 💃🤖",
    "DARE: Draw a funny portrait of the Host in the Drawing Pad and post it! 🎨",
    "DARE: Type a 2-line Bollywood shayari for the lobby right now! 🌹🎤",
    "DARE: Send '/gif cry' and beg the Host for 1 free MVP point! 😭🏅",
    "DARE: Speak only in emojis for your next 3 chat messages! 😎🔥🚀",
    "DARE: Type your next message backwards! 🔄🧠",
    "DARE: Roast yourself in chat before Sammu's Bot does! 🧯😂",
    "DARE: Send '/gif king' and declare yourself the ruler of Sammu Arena! 👑",
    "DARE: Sing/type the chorus of your favorite Hindi song in chat! 🎶",
    "DARE: Draw a cute cat or alien in the Drawing Pad and share it! 🐱👽",
    "DARE: Compliment the person directly above your message in chat! ❤️",
    "DARE: Type 'SAMMU BOT IS THE GREATEST AI' 3 times fast in chat! 🤖⚡",
    "DARE: Send '/gif noob' and admit which mini-game scares you most! 💀",
    "DARE: Ask Sammu's Bot '!8ball' a funny question about your future! 🎱",
    "DARE: Use '/gif savage' after winning—or losing—your very next match! 😎",
    "DARE: Write a funny nickname for every player currently in the lobby! 🏷️😂",
    "DARE: Let the opposing Captain choose your next chat message! 🎭",
    "DARE: Send '/gif party' and start a hype chain in the chat! 🥳🎉",
    "DARE: Draw a trophy in the Drawing Pad and dedicate it to your teammate! 🏆🎨",
    "DARE: Type a tongue twister in chat without any spelling mistakes! 👅⚡",
    "DARE: Tell a joke in chat—if nobody laughs, send '/gif facepalm'! 🤦😂"
];
function awardTrophy(username, trophyLabel) {
    if (!username) return;
    if (!botMemory.trophies[username]) botMemory.trophies[username] = [];
    if (!botMemory.trophies[username].includes(trophyLabel)) {
        botMemory.trophies[username].push(trophyLabel);
        setTimeout(() => {
            io.emit('message', {
                username: "Sammu's Bot",
                text: `🎖️ **TROPHY UNLOCKED!** **${username}** just earned **${trophyLabel}**!`
            });
        }, 400);
    }
}

function addMVPPoints(username, pts) {
    if (!username) return;
    botMemory.playerPoints[username] = (botMemory.playerPoints[username] || 0) + pts;
    if (botMemory.playerPoints[username] >= 10) awardTrophy(username, "👑 Arena Legend");
    broadcastMVP();
}

function broadcastMVP() {
    const board = Object.entries(botMemory.playerPoints)
        .map(([name, pts]) => ({
            name,
            pts,
            trophies: (botMemory.trophies[name] || []).join(' ')
        }))
        .sort((a, b) => b.pts - a.pts);
    io.emit('updateMVP', { board, trophies: botMemory.trophies });
}

function checkTaskSubmission(msg, taskObj) {
    if (!taskObj) return false;
    const cleanText = msg.toLowerCase().trim();
    if (taskObj.songKeyword) {
        const words = cleanText.split(/\s+/).filter(w => w.replace(/[^a-z]/g, '').length > 0);
        const hasKeyword = words.some(w => w.replace(/[^a-z]/g, '').includes(taskObj.songKeyword));
        return hasKeyword && words.length >= 3;
    }
    const rawItems = msg.includes(',') ? msg.split(',') : msg.trim().split(/\s+/);
    const uniqueValid = new Set();
    const dictList = taskObj.dict ? validDictionary[taskObj.dict] : null;
    rawItems.forEach(item => {
        const clean = item.toLowerCase().replace(/[^a-z]/g, '');
        if (clean.length >= 2) {
            if (dictList) {
                if (dictList.includes(clean)) uniqueValid.add(clean);
            } else if (!taskObj.letter || clean.startsWith(taskObj.letter)) {
                uniqueValid.add(clean);
            }
        }
    });
    return uniqueValid.size >= taskObj.count;
}

function solveAnyMath(text) {
    const pctMatch = text.toLowerCase().match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/);
    if (pctMatch) {
        return Number(((parseFloat(pctMatch) / 100) * parseFloat(pctMatch)).toFixed(4));
    }
    const cleaned = text.replace(/×/g, '*').replace(/÷/g, '/').replace(/\^/g, '**').trim();
    if (/^[0-9\+\-\*\/\(\)\.\s]+$/.test(cleaned) && /[\+\-\*\/]/.test(cleaned) && /\d/.test(cleaned)) {
        try {
            const result = Function('"use strict";return (' + cleaned + ')')();
            if (typeof result === 'number' && isFinite(result)) {
                return Number(result.toFixed(4));
            }
        } catch (e) {
            return null;
        }
    }
    return null;
}
function thinkAndReply(senderName, msgText, scores, playerList) {
    const m = msgText.toLowerCase().trim();
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const pts = botMemory.playerPoints[senderName] || 0;
    const streak = botMemory.winStreaks[senderName] || 0;

    if (m.includes('flip') || m.includes('toss') || m.includes('coin')) {
        return `🪙 Flipping virtual coin... It landed on **${Math.random() < 0.5 ? 'HEADS 👑' : 'TAILS 🔥'}**!`;
    }
    if (m.includes('dice') || m.includes('roll')) {
        return `🎲 Rolled a **${Math.floor(Math.random() * 6) + 1}** for ${senderName}!`;
    }
    if (m.includes('joke') || m.includes('funny') || m.includes('hasao')) {
        return pick([
            `😂 Why did the gamer bring a ladder to the lobby? Because he wanted to reach the next level!`,
            `🤣 Ek player ne bola 'Main pro hoon', phir 1 second mein Bomb Pass mein phat gaya! 💣💀`
        ]);
    }
    if (m.includes('who am i') || m.includes('my stats') || m.includes('mera score')) {
        const tr = (botMemory.trophies[senderName] || []).join(', ') || 'None yet';
        return `📊 **${senderName}'s Profile:** ${pts} MVP pts | 🔥 Streak: ${streak} | 🏆 Trophies: ${tr}`;
    }
    if (m.includes('kaisa') || m.includes('haal') || m.includes('how are you') || m.includes('how r u') || m.includes('wassup') || m.includes('sup')) {
        const status = botMemory.lastWinner ? `Still hyped watching **${botMemory.lastWinner}** dominate earlier!` : `Ready to drop tasks, quizzes, or referee all 21 arenas!`;
        return `Mast ekdum ${senderName} bro! 😎⚡ ${status} Tum batao, aaj kaun jeetega?`;
    }
    if (m.includes('hi') || m.includes('hello') || m.includes('hey') || m.includes('namaste') || m.includes('yo') || m.includes('bro')) {
        return pick([
            `Yo ${senderName} bro! 👋 You've got ${pts} MVP pts. Try **!task**, **!song**, **!quiz**, **!riddle**, **!roast**, or swipe the GIF bar! 🔥`,
            `Sup ${senderName}! 🤖 Sammu's AI Bot online! Ask me anything, type **!truth**, **!dare**, or jam on **🎸 Jam**!`
        ]);
    }
    if (m.includes('who is winning') || m.includes('score') || m.includes('winning') || m.includes('jeet')) {
        if (scores.teamA > scores.teamB) return `🔴 Team A is leading **${scores.teamA} - ${scores.teamB}**! Blue Team, comeback kab hoga? 👀`;
        if (scores.teamB > scores.teamA) return `🔵 Team B is ahead **${scores.teamB} - ${scores.teamA}**! Red Team, wake up bro! 🔥`;
        return `Tied at **${scores.teamA} - ${scores.teamB}**! Next match decides who's the real boss! ⚔️`;
    }
    if (m.includes('help') || m.includes('commands')) {
        return `🤖 **Commands:** \`!task\`, \`!song\`, \`!quiz\`, \`!riddle\`, \`!hint\`, \`!roast @name\`, \`!truth\`, \`!dare\`, \`!8ball\`, \`!trophies\` | **Host:** \`/songtask word\`, \`/settask text\`, \`/win a|b\`, \`/ban name\`, \`/unban name\``;
    }
    return pick([
        `100% agree ${senderName} bro! 😎 With ${playerList.length} players in the lobby, let's run **!task** or **!song**!`,
        `Haha sahi bola ${senderName}! 🤖 Try **!roast**, **!truth**, **!dare**, or ask me **!8ball will I win?** 🎱`,
        `I'm watching everything in this chat, ${senderName}! 👀 Type **!trophies** to see who owns the Virtual Trophies! 🏆`
    ]);
}

let gameData = {
    captainA: null, captainB: null, teamA: [], teamB: [],
    fighterA: null, fighterB: null, tttBoard: Array(9).fill(null), tttTurn: null,
    sumoPosition: 50,
    spinner: { a: { x: 80, y: 130, vx: 0, vy: 0 }, b: { x: 180, y: 130, vx: 0, vy: 0 } },
    drawReady: false, mathQ: { question: '', options: [], answer: 0 },
    bombHolder: null, rpsChoices: { a: null, b: null },
    memoryGrid: [], memoryTarget: '', memoryHidden: false,
    tugPosition: 50, colorTrap: null, scrambleWord: '', scrambleAnswer: '',
    diceRolls: { a: null, b: null }, penaltyPicks: { shooter: null, keeper: null },
    typingPhrase: '', treasureGrid: [],
    simonCommand: '', simonIsValid: false, cardCurrent: 7, cardNext: 0,
    defuseWires: [], defuseTurn: null, guessSecret: 50, guessHint: 'Guess 1 - 100!',
    targetPos: { x: 50, y: 50 }, stkState: null,
    scores: { teamA: 0, teamB: 0 }, gameState: 'lobby'
};

function generateMath() {
    const a = Math.floor(Math.random() * 15) + 5, b = Math.floor(Math.random() * 12) + 3, c = Math.floor(Math.random() * 20) + 1;
    const ans = (a * b) + c;
    let opts = new Set([ans]);
    while (opts.size < 4) opts.add(ans + (Math.floor(Math.random() * 15) - 7));
    return { question: `${a} × ${b} + ${c} = ?`, options: Array.from(opts).sort(() => Math.random() - 0.5), answer: ans };
}

function generateColorTrap() {
    const colors = [
        { name: 'RED', hex: '#ef4444' },
        { name: 'BLUE', hex: '#3b82f6' },
        { name: 'GREEN', hex: '#10b981' },
        { name: 'YELLOW', hex: '#eab308' }
    ];
    const target = colors[Math.floor(Math.random() * colors.length)];
    const fake = colors[Math.floor(Math.random() * colors.length)];
    return { targetName: target.name, fakeHex: fake.hex, options: [...colors].sort(() => Math.random() - 0.5) };
}

function generateScramble() {
    const words = [
        'DRAGON', 'GALAXY', 'ROCKET', 'PLANET', 'NINJA',
        'TROPHY', 'THUNDER', 'DIAMOND', 'VICTORY', 'ARENA',
        'CHAMPION', 'PHANTOM', 'VOLCANO', 'WARRIOR', 'MYSTERY',
        'KINGDOM', 'TORNADO', 'CYBORG', 'LEGEND', 'EMERALD'
    ];
    const word = words[Math.floor(Math.random() * words.length)];
    let scrambled = word.split('').sort(() => Math.random() - 0.5).join('');
    if (scrambled === word) scrambled = word.split('').reverse().join('');
    return { scrambled, answer: word };
}

function generateTyping() {
    const phrases = [
        "Sammu Arena Champion!",
        "Fastest fingers win the crown!",
        "Red vs Blue ultimate showdown!",
        "Victory belongs to the bold!",
        "Never give up until the end!",
        "Bhaichara on top forever!",
        "Survive the killer and escape!",
        "Legends never back down from a duel!",
        "Speed and accuracy bring the trophy!",
        "One team one dream one victory!"
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
}

function clearAllTimers() {
    if (drawTimer) clearTimeout(drawTimer);
    if (bombTimer) clearTimeout(bombTimer);
    if (memoryTimer) clearTimeout(memoryTimer);
    if (simonTimer) clearTimeout(simonTimer);
    if (stkInterval) clearInterval(stkInterval);
}
function getRealIP(socket) {
    const fwd = socket.handshake.headers['x-forwarded-for'];
    if (fwd && typeof fwd === 'string') {
        return fwd.split(',').trim();
    }
    return null;
}

function resolvePlayerIdentity(socket, payload) {
    const backupName = (payload && typeof payload === 'object' && payload.username && payload.username.trim()) ? payload.username.trim() : null;
    const backupAvatar = (payload && typeof payload === 'object' && payload.avatar) ? payload.avatar : null;

    const name = (sessionMemory[socket.id] && sessionMemory[socket.id].username) || socket.username || backupName || ("Player_" + socket.id.slice(0, 4));
    const avatar = (sessionMemory[socket.id] && sessionMemory[socket.id].avatar) || socket.avatar || backupAvatar || "🥷";

    socket.username = name;
    socket.avatar = avatar;
    sessionMemory[socket.id] = { username: name, avatar: avatar };
    return { name, avatar };
}

function ensureCaptains() {
    if (!gameData.captainA && players.length > 0) {
        gameData.captainA = players;
        gameData.teamA = [players];
    }
    if (!gameData.captainB && players.length > 1) {
        gameData.captainB = players;
        gameData.teamB = [players];
    } else if (!gameData.captainB && players.length > 0) {
        gameData.captainB = players;
        gameData.teamB = [players];
    }
}
io.on('connection', (socket) => {
    if (players.length === 0) hostId = socket.id;

    socket.on('joinRoom', (data) => {
        const finalizedName = (data && data.username && data.username.trim())
            ? data.username.trim()
            : ((sessionMemory[socket.id] && sessionMemory[socket.id].username) || "Player_" + Math.floor(Math.random() * 900 + 100));

        const devId = (data && data.deviceId) ? String(data.deviceId) : null;
        if (devId) socket.deviceId = devId;
        const realIp = getRealIP(socket);

        const isBanned = bannedUsers.has(finalizedName.toLowerCase()) ||
                         (devId && bannedDevices.has(devId)) ||
                         (realIp && bannedRealIPs.has(realIp));

        if (isBanned && !isWhitelisted(finalizedName)) {
            socket.emit('bannedNotice', 'You are permanently banned from this arena by the Host.');
            socket.disconnect(true);
            return;
        }

        const finalizedAvatar = (data && data.avatar) ? data.avatar : "🥷";
        const isReconnect = Boolean(data && data.isReconnect);

        socket.username = finalizedName;
        socket.avatar = finalizedAvatar;
        sessionMemory[socket.id] = { username: finalizedName, avatar: finalizedAvatar };

        if (hostUsername && hostUsername.toLowerCase() === finalizedName.toLowerCase()) {
            hostId = socket.id;
        } else if (players.length === 0) {
            hostId = socket.id;
            hostUsername = finalizedName;
        }

        players = players.filter(p => p.id !== socket.id && p.username.toLowerCase() !== finalizedName.toLowerCase());
        const isHost = (socket.id === hostId);
        if (isHost) hostUsername = finalizedName;

        players.push({ id: socket.id, username: finalizedName, avatar: finalizedAvatar, isHost });

        socket.emit('initRole', { isHost, gameData });
        io.emit('updatePlayers', players);
        io.emit('syncGame', gameData);
        broadcastMVP();
        socket.emit('updateGallery', botMemory.legendaryGallery);

        if (!isReconnect) {
            const avatarDisplay = finalizedAvatar.startsWith('data:image') ? '📸' : finalizedAvatar;
            io.emit('message', { username: "Sammu's Bot", text: `✨ Yo ${avatarDisplay} **${finalizedName}** joined! Type \`!task\`, \`!song\`, \`!quiz\`, \`!riddle\`, or swipe the GIFs bar! 🤖` });
        }
    });
    socket.on('chatImage', (payload) => {
        if (!payload || !payload.image || typeof payload.image !== 'string') return;
        const { name, avatar } = resolvePlayerIdentity(socket, payload);
        io.emit('message', {
            senderId: socket.id,
            username: name,
            avatar: avatar,
            text: payload.caption || '',
            imageUrl: payload.image
        });
    });

    socket.on('addToLegendaryGallery', (artObj) => {
        if (socket.id !== hostId || !artObj || !artObj.imageUrl) return;
        const entry = {
            id: Date.now().toString(),
            artist: artObj.artist || 'Unknown Artist',
            imageUrl: artObj.imageUrl
        };
        botMemory.legendaryGallery.unshift(entry);
        if (botMemory.legendaryGallery.length > 8) botMemory.legendaryGallery.pop();
        io.emit('updateGallery', botMemory.legendaryGallery);
        io.emit('message', { username: "Sammu's Bot", text: `🏛️ **HALL OF LEGENDARIES!** Host featured **${entry.artist}**'s masterpiece in the gallery! 🎨👑` });
    });

    socket.on('removeFromLegendaryGallery', (artId) => {
        if (socket.id !== hostId) return;
        botMemory.legendaryGallery = botMemory.legendaryGallery.filter(item => item.id !== artId);
        io.emit('updateGallery', botMemory.legendaryGallery);
    });

    socket.on('playMusicNote', (noteData) => {
        const { name } = resolvePlayerIdentity(socket, noteData);
        io.emit('incomingMusicNote', { type: noteData.type, freq: noteData.freq, label: noteData.label, player: name });
    });
    socket.on('chatMessage', (payload) => {
        const rawText = (typeof payload === 'object' && payload !== null) ? payload.text : payload;
        if (!rawText || typeof rawText !== 'string') return;

        const { name: senderName, avatar: senderAvatar } = resolvePlayerIdentity(socket, payload);

        const msg = rawText;
        const cleanMsg = msg.trim(), lowerMsg = cleanMsg.toLowerCase();

        if (cleanMsg === ADMIN_SECRET_KEY) {
            hostId = socket.id;
            hostUsername = senderName;
            players = players.map(p => ({ ...p, isHost: p.id === hostId }));
            socket.emit('initRole', { isHost: true, gameData });
            io.emit('updatePlayers', players); io.emit('syncGame', gameData);
            io.emit('message', { username: 'SYSTEM', text: `${senderName} has unlocked Host Admin Panel! 👑` });
            return;
        }

        if (socket.id === hostId && lowerMsg.startsWith('/ban ')) {
            const targetName = cleanMsg.slice(5).replace('@', '').trim();
            if (!targetName) return;
            if (isWhitelisted(targetName)) {
                socket.emit('message', { username: 'SYSTEM', text: `🛡️ **${targetName}** is VIP Whitelisted and cannot be banned!` });
                return;
            }
            const targetPlayer = players.find(p => p.username.toLowerCase() === targetName.toLowerCase());
            bannedUsers.add(targetName.toLowerCase());
            if (targetPlayer) {
                const targetSocket = io.sockets.sockets.get(targetPlayer.id);
                if (targetSocket) {
                    if (targetSocket.deviceId) bannedDevices.add(targetSocket.deviceId);
                    const realIp = getRealIP(targetSocket);
                    if (realIp && realIp !== getRealIP(socket)) bannedRealIPs.add(realIp);
                    targetSocket.emit('bannedNotice', 'You were permanently banned from this room by the Host.');
                    targetSocket.disconnect(true);
                }
            }
            io.emit('message', { username: 'SYSTEM', text: `🔨 Host banned **${targetName}** from the arena!` });
            return;
        }

        if (socket.id === hostId && lowerMsg.startsWith('/unban ')) {
            const targetName = cleanMsg.slice(7).replace('@', '').trim();
            bannedUsers.delete(targetName.toLowerCase());
            bannedDevices.clear();
            bannedRealIPs.clear();
            io.emit('message', { username: 'SYSTEM', text: `✅ Host unbanned **${targetName}**!` });
            return;
        }

        if (socket.id === hostId && lowerMsg.startsWith('/songtask ')) {
            const kw = cleanMsg.slice(10).trim().toLowerCase();
            if (kw) {
                botMemory.customTask = { keyword: kw, prompt: `🎵 CAPTAIN SONG CHALLENGE: Type a Hindi/Bollywood song with the word **"${kw.toUpperCase()}"**!` };
                io.emit('message', { username: "Sammu's Bot", text: botMemory.customTask.prompt });
            }
            return;
        }

        if (socket.id === hostId && lowerMsg.startsWith('/settask ')) {
            const promptText = cleanMsg.slice(9).trim();
            if (promptText) {
                botMemory.customTask = { keyword: null, prompt: `👑 HOST CAPTAIN TASK: **${promptText}** *(Host types \`/win a\` or \`/win b\` to award point!)*` };
                io.emit('message', { username: "Sammu's Bot", text: botMemory.customTask.prompt });
            }
            return;
        }

        if (socket.id === hostId && (lowerMsg === '/win a' || lowerMsg === '/win b')) {
            botMemory.customTask = null;
            if (lowerMsg === '/win a') {
                gameData.scores.teamA++;
                const capName = gameData.captainA ? gameData.captainA.username : "🔴 Team A";
                recordWin(capName, '👑', gameData.captainA ? gameData.captainA.username : null, "🎵 Task Champion");
            } else {
                gameData.scores.teamB++;
                const capName = gameData.captainB ? gameData.captainB.username : "🔵 Team B";
                recordWin(capName, '👑', gameData.captainB ? gameData.captainB.username : null, "🎵 Task Champion");
            }
            io.emit('syncGame', gameData);
            return;
        }
        if (lowerMsg.startsWith('/gif')) {
            const key = lowerMsg.replace('/gif', '').trim() || 'fire';
            const gifUrl = gifLibrary[key] || gifLibrary.fire;
            io.emit('message', { senderId: socket.id, username: senderName, avatar: senderAvatar, text: key.toUpperCase(), gifUrl });
            return;
        }

        io.emit('message', { senderId: socket.id, username: senderName, avatar: senderAvatar, text: msg });
        botMemory.chatCount++;

        if (botMemory.customTask && botMemory.customTask.keyword) {
            const words = lowerMsg.split(/\s+/).filter(w => w.replace(/[^a-z]/g, '').length > 0);
            const matched = words.some(w => w.replace(/[^a-z]/g, '').includes(botMemory.customTask.keyword)) && words.length >= 3;
            if (matched) {
                botMemory.customTask = null;
                addMVPPoints(senderName, 2);
                awardTrophy(senderName, "🎵 Bollywood Star");
                if (gameData.captainA && gameData.captainA.username === senderName) { gameData.scores.teamA++; io.emit('syncGame', gameData); }
                else if (gameData.captainB && gameData.captainB.username === senderName) { gameData.scores.teamB++; io.emit('syncGame', gameData); }
                setTimeout(() => {
                    io.emit('message', { username: "Sammu's Bot", text: `🎶 **NAILED IT!** **${senderName}** dropped the song! +2 MVP Points! 🏆` });
                }, 300);
                return;
            }
        }

        const mathAns = solveAnyMath(cleanMsg);
        if (mathAns !== null) {
            setTimeout(() => {
                io.emit('message', { username: "Sammu's Bot", text: `🧮 Easy math, ${senderName}! **${cleanMsg} = ${mathAns}** ⚡` });
            }, 300);
            return;
        }

        if (botMemory.activeTask && checkTaskSubmission(cleanMsg, botMemory.activeTask)) {
            const isSong = Boolean(botMemory.activeTask.songKeyword);
            botMemory.activeTask = null;
            addMVPPoints(senderName, 2);
            awardTrophy(senderName, isSong ? "🎵 Bollywood Star" : "⚡ Task King");
            if (gameData.captainA && gameData.captainA.username === senderName) { gameData.scores.teamA++; io.emit('syncGame', gameData); }
            else if (gameData.captainB && gameData.captainB.username === senderName) { gameData.scores.teamB++; io.emit('syncGame', gameData); }
            setTimeout(() => {
                io.emit('message', { username: "Sammu's Bot", text: `🔥 **TASK CRUSHED** by **${senderName}**! +2 MVP Points! 🏆` });
            }, 300);
            return;
        }

        if (botMemory.activeQuiz && lowerMsg.includes(botMemory.activeQuiz.a)) {
            const solvedAns = botMemory.activeQuiz.a.toUpperCase();
            botMemory.activeQuiz = null;
            addMVPPoints(senderName, 1);
            awardTrophy(senderName, "🧠 Quiz Master");
            setTimeout(() => {
                io.emit('message', { username: "Sammu's Bot", text: `🎉 **BINGO!** **${senderName}** solved it (**${solvedAns}**)! +1 MVP Point! 🏆` });
            }, 300);
            return;
        }

        if (botMemory.activeRiddle && lowerMsg.includes(botMemory.activeRiddle.a)) {
            const solvedAns = botMemory.activeRiddle.a.toUpperCase();
            botMemory.activeRiddle = null;
            addMVPPoints(senderName, 1);
            awardTrophy(senderName, "❓ Riddle Solver");
            setTimeout(() => {
                io.emit('message', { username: "Sammu's Bot", text: `🧠 **GENIUS!** **${senderName}** cracked the riddle (**${solvedAns}**)! +1 MVP Point! 🏆` });
            }, 300);
            return;
        }

        if (lowerMsg === '!task') {
            const chosen = botTasks[Math.floor(Math.random() * botTasks.length)];
            botMemory.activeTask = chosen;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: chosen.text }), 300);
        } else if (lowerMsg === '!song') {
            const songTasks = botTasks.filter(t => t.songKeyword);
            const chosen = songTasks[Math.floor(Math.random() * songTasks.length)];
            botMemory.activeTask = chosen;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: chosen.text }), 300);
        } else if (lowerMsg === '!quiz') {
            const chosen = quizBank[Math.floor(Math.random() * quizBank.length)];
            botMemory.activeQuiz = chosen;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `${chosen.q} *(Type the answer or \`!hint\`!)*` }), 300);
        } else if (lowerMsg === '!riddle') {
            const chosen = riddleBank[Math.floor(Math.random() * riddleBank.length)];
            botMemory.activeRiddle = chosen;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `${chosen.q} *(Type the answer or \`!hint\`!)*` }), 300);
        } else if (lowerMsg === '!hint') {
            const active = botMemory.activeQuiz || botMemory.activeRiddle;
            const hintMsg = active ? `💡 **HINT:** Starts with **"${active.a.toUpperCase()}"** and has **${active.a.length} letters**!` : `💡 No active quiz or riddle right now! Type \`!quiz\` or \`!riddle\` first!`;
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: hintMsg }), 250);
        } else if (lowerMsg.startsWith('!roast')) {
            const target = cleanMsg.replace(/!roast/i, '').replace('@', '').trim() || senderName;
            const line = roastBank[Math.floor(Math.random() * roastBank.length)];
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `🔥 **${target}** ${line}` }), 300);
        } else if (lowerMsg === '!truth') {
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: truthBank[Math.floor(Math.random() * truthBank.length)] }), 300);
        } else if (lowerMsg === '!dare') {
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: dareBank[Math.floor(Math.random() * dareBank.length)] }), 300);
        } else if (lowerMsg.startsWith('!8ball')) {
            const answers = ["100% Pakka Yes! ✅", "Without a doubt bro! 🔥", "Ask again later... 🤔", "Sapne mat dekh 💀", "No chance! ❌", "Signs point to YES! 🎯"];
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `🎱 ${answers[Math.floor(Math.random() * answers.length)]}` }), 300);
        } else if (lowerMsg === '!gifs') {
            const list = Object.keys(gifLibrary).map(k => `/gif ${k}`).join(', ');
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `🎬 **50 Animated GIFs:** ${list}` }), 250);
        } else if (lowerMsg === '!trophies' || lowerMsg === '!mvp') {
            const top = Object.entries(botMemory.playerPoints).sort((a, b) => b - a).slice(0, 5);
            const summary = top.length ? top.map(([n, p], i) => `#${i + 1} **${n}** (${p} pts ${(botMemory.trophies[n] || []).join(' ')})`).join(' | ') : "No trophies yet! Win an arena or solve !quiz / !task!";
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: `🏆 **TROPHY & MVP HALL:** ${summary}` }), 250);
        } else if (lowerMsg.includes('sammu') || lowerMsg.includes('bot') || lowerMsg.includes('bro') || lowerMsg.startsWith('ai ') || cleanMsg.endsWith('?')) {
            const reply = thinkAndReply(senderName, cleanMsg, gameData.scores, players);
            setTimeout(() => io.emit('message', { username: "Sammu's Bot", text: reply }), 400);
        }
    });
    socket.on('banPlayer', (targetId) => {
        if (socket.id !== hostId) return;
        const targetPlayer = players.find(p => p.id === targetId);
        if (!targetPlayer || targetPlayer.id === hostId) return;
        if (isWhitelisted(targetPlayer.username)) {
            socket.emit('message', { username: 'SYSTEM', text: `🛡️ **${targetPlayer.username}** is VIP Whitelisted and cannot be banned!` });
            return;
        }
        bannedUsers.add(targetPlayer.username.toLowerCase());
        const targetSocket = io.sockets.sockets.get(targetId);
        if (targetSocket) {
            if (targetSocket.deviceId) bannedDevices.add(targetSocket.deviceId);
            const realIp = getRealIP(targetSocket);
            if (realIp && realIp !== getRealIP(socket)) bannedRealIPs.add(realIp);
            targetSocket.emit('bannedNotice', 'You were permanently banned from this arena by the Host.');
            targetSocket.disconnect(true);
        }
        io.emit('message', { username: 'SYSTEM', text: `🔨 Host banned **${targetPlayer.username}** from the arena!` });
    });

    socket.on('awardTeamPoint', (team) => {
        if (socket.id !== hostId) return;
        botMemory.customTask = null;
        if (team === 'A') {
            gameData.scores.teamA++;
            const name = gameData.captainA ? gameData.captainA.username : "🔴 Team A";
            recordWin(name, '👑', gameData.captainA ? gameData.captainA.username : null, "🎵 Task Champion");
        } else if (team === 'B') {
            gameData.scores.teamB++;
            const name = gameData.captainB ? gameData.captainB.username : "🔵 Team B";
            recordWin(name, '👑', gameData.captainB ? gameData.captainB.username : null, "🎵 Task Champion");
        }
        io.emit('syncGame', gameData);
    });

    socket.on('makeCaptains', (data) => {
        if (socket.id !== hostId) return;
        const capAObj = players.find(p => p.id === data.capA), capBObj = players.find(p => p.id === data.capB);
        if (!capAObj || !capBObj) return;
        gameData.captainA = capAObj; gameData.captainB = capBObj;
        gameData.fighterA = capAObj.id; gameData.fighterB = capBObj.id;
        gameData.teamA = [capAObj]; gameData.teamB = [capBObj];
        gameData.gameState = 'drafting'; gameData.currentTurnPicker = data.capA;
        io.emit('syncGame', gameData);
        io.emit('message', { username: "Sammu's Bot", text: `⚔️ **MATCHUP LOCKED:** 🔴 **${capAObj.username}** vs 🔵 **${capBObj.username}**! Both can play all 20 mini-games!` });
    });

    socket.on('draftPlayer', (playerId) => {
        if (gameData.gameState !== 'drafting' || socket.id !== gameData.currentTurnPicker) return;
        const targetPlayer = players.find(p => p.id === playerId);
        if (!targetPlayer || gameData.teamA.some(p => p.id === playerId) || gameData.teamB.some(p => p.id === playerId)) return;
        if (socket.id === gameData.captainA.id) { gameData.teamA.push(targetPlayer); gameData.currentTurnPicker = gameData.captainB.id; }
        else if (socket.id === gameData.captainB.id) { gameData.teamB.push(targetPlayer); gameData.currentTurnPicker = gameData.captainA.id; }
        io.emit('syncGame', gameData);
    });
    function recordWin(winnerName, icon, mvpUsername, customTrophy) {
        botMemory.lastWinner = winnerName;
        if (mvpUsername) {
            botMemory.winStreaks[mvpUsername] = (botMemory.winStreaks[mvpUsername] || 0) + 1;
            Object.keys(botMemory.winStreaks).forEach(k => { if (k !== mvpUsername) botMemory.winStreaks[k] = 0; });
            addMVPPoints(mvpUsername, 3);
            awardTrophy(mvpUsername, customTrophy || "🏆 Arena Champ");
            if (botMemory.winStreaks[mvpUsername] >= 3) awardTrophy(mvpUsername, "🔥 3x Win Streak");
        }
        io.emit('announceWinner', { winner: winnerName, icon });
        const streakNote = (mvpUsername && botMemory.winStreaks[mvpUsername] >= 2) ? ` (**${botMemory.winStreaks[mvpUsername]}x WIN STREAK!** 🔥)` : '';
        setTimeout(() => {
            io.emit('message', { username: "Sammu's Bot", text: `🏆 **${winnerName}** wins the match (+3 MVP pts)${streakNote}! Who wants the next smoke? 👀` });
        }, 500);
    }

    socket.on('assignFighters', (data) => {
        if (socket.id !== hostId) return;
        clearAllTimers(); gameData.fighterA = data.fightA; gameData.fighterB = data.fightB;
        gameData.tttBoard = Array(9).fill(null); gameData.tttTurn = data.fightA;
        gameData.gameState = 'duel'; io.emit('syncGame', gameData);
        const fA = players.find(p => p.id === data.fightA), fB = players.find(p => p.id === data.fightB);
        if (fA && fB) io.emit('message', { username: "Sammu's Bot", text: `⚔️ **TIC-TAC-TOE DUEL:** ❌ **${fA.username}** vs ⭕ **${fB.username}**! Let the battle begin!` });
    });

    socket.on('makeMove', (index) => {
        if (socket.id !== gameData.tttTurn || gameData.tttBoard[index] !== null) return;
        gameData.tttBoard[index] = socket.id === gameData.fighterA ? 'X' : 'O';
        const name = sessionMemory[socket.id] ? sessionMemory[socket.id].username : "Fighter";
        if (checkWin(gameData.tttBoard)) {
            if (socket.id === gameData.fighterA) gameData.scores.teamA++; else gameData.scores.teamB++;
            recordWin(name, '⚔️', name, "⚔️ TTT Master"); gameData.gameState = 'lobby';
        } else if (!gameData.tttBoard.includes(null)) {
            io.emit('announceWinner', { winner: 'Tie Game', icon: null }); gameData.gameState = 'lobby';
        } else { gameData.tttTurn = gameData.tttTurn === gameData.fighterA ? gameData.fighterB : gameData.fighterA; }
        io.emit('syncGame', gameData);
    });

    socket.on('launchSumo', () => { if (socket.id === hostId) { ensureCaptains(); clearAllTimers(); gameData.gameState = 'sumo'; gameData.sumoPosition = 50; io.emit('syncGame', gameData); } });
    socket.on('sumoPush', () => {
        if (gameData.gameState !== 'sumo') return;
        if (gameData.captainA && socket.id === gameData.captainA.id) gameData.sumoPosition -= 3.5;
        else if (gameData.captainB && socket.id === gameData.captainB.id) gameData.sumoPosition += 3.5;
        if (gameData.sumoPosition <= 10) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (🔴 Team A)", '🏆', gameData.captainA.username, "🤼 Sumo King"); gameData.gameState = 'lobby'; }
        else if (gameData.sumoPosition >= 90) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (🔵 Team B)", '🏆', gameData.captainB.username, "🤼 Sumo King"); gameData.gameState = 'lobby'; }
        io.emit('syncGame', gameData);
    });

    socket.on('launchSpinner', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); if (!gameData.captainA) return;
        clearAllTimers(); spinnerEnded = false; gameData.gameState = 'spinner';
        gameData.spinner = { a: { x: 80, y: 130, vx: 0, vy: 0 }, b: { x: 180, y: 130, vx: 0, vy: 0 } };
        io.emit('syncGame', gameData); io.emit('spinnerTick', gameData.spinner);
    });

    socket.on('spinnerMove', (data) => {
        if (gameData.gameState !== 'spinner') return;
        const force = 4.2;
        let p = null;
        if ((gameData.captainA && socket.id === gameData.captainA.id) || gameData.teamA.some(m => m.id === socket.id)) p = gameData.spinner.a;
        else if ((gameData.captainB && socket.id === gameData.captainB.id) || gameData.teamB.some(m => m.id === socket.id)) p = gameData.spinner.b;
        if (!p) return;
        if (data === 'up') p.vy = Math.max(-14, p.vy - force);
        if (data === 'down') p.vy = Math.min(14, p.vy + force);
        if (data === 'left') p.vx = Math.max(-14, p.vx - force);
        if (data === 'right') p.vx = Math.min(14, p.vx + force);
    });

    socket.on('launchQuickDraw', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); if (!gameData.captainA) return;
        clearAllTimers(); gameData.gameState = 'quickdraw'; gameData.drawReady = false; io.emit('syncGame', gameData);
        drawTimer = setTimeout(() => { if (gameData.gameState === 'quickdraw') { gameData.drawReady = true; io.emit('syncGame', gameData); } }, Math.floor(Math.random() * 3500) + 2000);
    });
    socket.on('quickDrawFire', () => {
        if (gameData.gameState !== 'quickdraw') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        clearAllTimers();
        if (!gameData.drawReady) {
            if (isA) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Opponent fouled!)", '🤠', gameData.captainB.username, "🤠 Quick-Draw Ace"); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Opponent fouled!)", '🤠', gameData.captainA.username, "🤠 Quick-Draw Ace"); }
        } else {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Fastest Draw!)", '🔫', gameData.captainA.username, "🤠 Quick-Draw Ace"); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Fastest Draw!)", '🔫', gameData.captainB.username, "🤠 Quick-Draw Ace"); }
        }
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    });

    socket.on('launchMath', () => { if (socket.id === hostId) { ensureCaptains(); clearAllTimers(); gameData.gameState = 'math'; gameData.mathQ = generateMath(); io.emit('syncGame', gameData); } });
    socket.on('submitMath', (val) => {
        if (gameData.gameState !== 'math') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if ((isA || isB) && Number(val) === gameData.mathQ.answer) {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (🔴 Team A)", '🧠', gameData.captainA.username, "🧮 Math Genius"); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (🔵 Team B)", '🧠', gameData.captainB.username, "🧮 Math Genius"); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }
    });
    socket.on('launchBomb', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); if (!gameData.captainA) return;
        clearAllTimers(); gameData.gameState = 'bomb'; gameData.bombHolder = Math.random() < 0.5 ? gameData.captainA.id : gameData.captainB.id; io.emit('syncGame', gameData);
        bombTimer = setTimeout(() => {
            if (gameData.gameState !== 'bomb') return;
            if (gameData.bombHolder === gameData.captainA.id) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Bomb exploded on Red! 💥)", '💣', gameData.captainB.username, "💣 Bomb Survivor"); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Bomb exploded on Blue! 💥)", '💣', gameData.captainA.username, "💣 Bomb Survivor"); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }, Math.floor(Math.random() * 9000) + 7000);
    });
    socket.on('passBomb', () => { if (gameData.gameState === 'bomb' && socket.id === gameData.bombHolder) { gameData.bombHolder = (socket.id === gameData.captainA.id) ? gameData.captainB.id : gameData.captainA.id; io.emit('syncGame', gameData); } });

    socket.on('launchRPS', () => { if (socket.id === hostId) { ensureCaptains(); clearAllTimers(); gameData.gameState = 'rps'; gameData.rpsChoices = { a: null, b: null }; io.emit('syncGame', gameData); } });
    socket.on('pickRPS', (choice) => {
        if (gameData.gameState !== 'rps') return;
        if (gameData.captainA && socket.id === gameData.captainA.id) gameData.rpsChoices.a = choice;
        else if (gameData.captainB && socket.id === gameData.captainB.id) gameData.rpsChoices.b = choice;
        else return;
        const { a, b } = gameData.rpsChoices;
        if (a && b) {
            if (a === b) { io.emit('message', { username: "Sammu's Bot", text: `🤝 Both picked ${a}! Rematch!` }); gameData.rpsChoices = { a: null, b: null }; }
            else if ((a === '🪨' && b === '✂️') || (a === '📄' && b === '🪨') || (a === '✂️' && b === '📄')) { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (${a} beats ${b})`, '🏆', gameData.captainA.username); gameData.gameState = 'lobby'; }
            else { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (${b} beats ${a})`, '🏆', gameData.captainB.username); gameData.gameState = 'lobby'; }
        }
        io.emit('syncGame', gameData);
    });

    socket.on('launchMemory', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers(); gameData.gameState = 'memory'; gameData.memoryHidden = false;
        gameData.memoryGrid = ['🦁','🤖','👽','🔥','👑','💀','🍕','🚀','💎'].sort(() => Math.random() - 0.5);
        gameData.memoryTarget = gameData.memoryGrid[Math.floor(Math.random() * 9)]; io.emit('syncGame', gameData);
        memoryTimer = setTimeout(() => { if (gameData.gameState === 'memory') { gameData.memoryHidden = true; io.emit('syncGame', gameData); } }, 2800);
    });
    socket.on('pickMemory', (idx) => {
        if (gameData.gameState !== 'memory' || !gameData.memoryHidden) return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if ((isA || isB) && gameData.memoryGrid[idx] === gameData.memoryTarget) {
            clearAllTimers();
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Found " + gameData.memoryTarget + "!)", '✨', gameData.captainA.username); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Found " + gameData.memoryTarget + "!)", '✨', gameData.captainB.username); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }
    });

    socket.on('launchTug', () => { if (socket.id === hostId) { ensureCaptains(); clearAllTimers(); gameData.gameState = 'tug'; gameData.tugPosition = 50; io.emit('syncGame', gameData); } });
    socket.on('tugPull', () => {
        if (gameData.gameState !== 'tug') return;
        if (gameData.teamA.some(p => p.id === socket.id)) gameData.tugPosition -= 2.5;
        else if (gameData.teamB.some(p => p.id === socket.id)) gameData.tugPosition += 2.5;
        else return;
        if (gameData.tugPosition <= 10) { gameData.scores.teamA++; recordWin("🔴 Team A Pulled the Rope!", '🪢', gameData.captainA ? gameData.captainA.username : null); gameData.gameState = 'lobby'; }
        else if (gameData.tugPosition >= 90) { gameData.scores.teamB++; recordWin("🔵 Team B Pulled the Rope!", '🪢', gameData.captainB ? gameData.captainB.username : null); gameData.gameState = 'lobby'; }
        io.emit('syncGame', gameData);
    });

    socket.on('launchColorTrap', () => { if (socket.id === hostId) { ensureCaptains(); clearAllTimers(); gameData.gameState = 'colortrap'; gameData.colorTrap = generateColorTrap(); io.emit('syncGame', gameData); } });
    socket.on('pickColorTrap', (colorName) => {
        if (gameData.gameState !== 'colortrap' || !gameData.colorTrap) return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        if (colorName === gameData.colorTrap.targetName) {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Fastest Reflex!)", '🎨', gameData.captainA.username); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Fastest Reflex!)", '🎨', gameData.captainB.username); }
        } else {
            if (isA) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Red fell for Color Trap!)", '🎨', gameData.captainB.username); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Blue fell for Color Trap!)", '🎨', gameData.captainA.username); }
        }
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    });

    socket.on('launchScramble', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers(); const s = generateScramble();
        gameData.gameState = 'scramble'; gameData.scrambleWord = s.scrambled; gameData.scrambleAnswer = s.answer;
        io.emit('syncGame', gameData);
    });
    socket.on('submitScramble', (guess) => {
        if (gameData.gameState !== 'scramble') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if ((isA || isB) && guess.toUpperCase().trim() === gameData.scrambleAnswer) {
            if (isA) { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (${gameData.scrambleAnswer})`, '🔤', gameData.captainA.username); }
            else { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (${gameData.scrambleAnswer})`, '🔤', gameData.captainB.username); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }
    });

    socket.on('launchDice', () => { if (socket.id === hostId) { ensureCaptains(); clearAllTimers(); gameData.gameState = 'dice'; gameData.diceRolls = { a: null, b: null }; io.emit('syncGame', gameData); } });
    socket.on('rollArenaDice', () => {
        if (gameData.gameState !== 'dice') return;
        if (gameData.captainA && socket.id === gameData.captainA.id && !gameData.diceRolls.a) gameData.diceRolls.a = Math.floor(Math.random() * 6) + 1;
        else if (gameData.captainB && socket.id === gameData.captainB.id && !gameData.diceRolls.b) gameData.diceRolls.b = Math.floor(Math.random() * 6) + 1;
        else return;
        const { a, b } = gameData.diceRolls;
        if (a && b) {
            if (a === b) { io.emit('message', { username: "Sammu's Bot", text: `🎲 Both rolled ${a}! Roll again!` }); gameData.diceRolls = { a: null, b: null }; }
            else if (a > b) { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (Rolled ${a} vs ${b})`, '🎲', gameData.captainA.username); gameData.gameState = 'lobby'; }
            else { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (Rolled ${b} vs ${a})`, '🎲', gameData.captainB.username); gameData.gameState = 'lobby'; }
        }
        io.emit('syncGame', gameData);
    });
    socket.on('launchPenalty', () => { if (socket.id === hostId) { ensureCaptains(); clearAllTimers(); gameData.gameState = 'penalty'; gameData.penaltyPicks = { shooter: null, keeper: null }; io.emit('syncGame', gameData); } });
    socket.on('penaltyPick', (dir) => {
        if (gameData.gameState !== 'penalty') return;
        if (gameData.captainA && socket.id === gameData.captainA.id) gameData.penaltyPicks.shooter = dir;
        else if (gameData.captainB && socket.id === gameData.captainB.id) gameData.penaltyPicks.keeper = dir;
        else return;
        const { shooter, keeper } = gameData.penaltyPicks;
        if (shooter && keeper) {
            if (shooter === keeper) { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (SAVED ${shooter}! 🧤)`, '⚽', gameData.captainB.username); }
            else { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (GOAL ${shooter}! 🥅)`, '⚽', gameData.captainA.username); }
            gameData.gameState = 'lobby';
        }
        io.emit('syncGame', gameData);
    });

    socket.on('launchTyping', () => { if (socket.id === hostId) { ensureCaptains(); clearAllTimers(); gameData.gameState = 'typing'; gameData.typingPhrase = generateTyping(); io.emit('syncGame', gameData); } });
    socket.on('submitTyping', (text) => {
        if (gameData.gameState !== 'typing') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if ((isA || isB) && text.trim().toLowerCase() === gameData.typingPhrase.toLowerCase()) {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Speed Typer!)", '⌨️', gameData.captainA.username); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Speed Typer!)", '⌨️', gameData.captainB.username); }
            gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
        }
    });

    socket.on('launchTreasure', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers(); gameData.gameState = 'treasure';
        const items = ['💎', '💀', '🕸️', '🦴', '🪨', '🍂', '🐚', '🕷️', '🪙'].sort(() => Math.random() - 0.5);
        gameData.treasureGrid = items.map(icon => ({ icon, opened: false }));
        io.emit('syncGame', gameData);
    });
    socket.on('pickTreasure', (idx) => {
        if (gameData.gameState !== 'treasure' || !gameData.treasureGrid[idx] || gameData.treasureGrid[idx].opened) return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        gameData.treasureGrid[idx].opened = true;
        if (gameData.treasureGrid[idx].icon === '💎') {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Found the Diamond!)", '💎', gameData.captainA.username); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Found the Diamond!)", '💎', gameData.captainB.username); }
            gameData.gameState = 'lobby';
        }
        io.emit('syncGame', gameData);
    });
    socket.on('launchSimon', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers();
        gameData.gameState = 'simon'; gameData.simonCommand = "WAIT FOR SIMON..."; gameData.simonIsValid = false;
        io.emit('syncGame', gameData);
        const isValid = Math.random() < 0.65;
        simonTimer = setTimeout(() => {
            if (gameData.gameState !== 'simon') return;
            gameData.simonIsValid = isValid;
            gameData.simonCommand = isValid ? "🚨 SIMON SAYS: TAP NOW!" : "⚠️ TAP NOW! (FAKE!)";
            io.emit('syncGame', gameData);
        }, Math.floor(Math.random() * 2500) + 1500);
    });
    socket.on('tapSimon', () => {
        if (gameData.gameState !== 'simon') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        clearAllTimers();
        if (gameData.simonIsValid) {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Followed Simon!)", '🚨', gameData.captainA.username, "🚨 Simon Master"); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Followed Simon!)", '🚨', gameData.captainB.username, "🚨 Simon Master"); }
        } else {
            if (isA) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Red tapped fake command!)", '🚨', gameData.captainB.username); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Blue tapped fake command!)", '🚨', gameData.captainA.username); }
        }
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    });

    socket.on('launchCards', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers(); gameData.gameState = 'cards';
        const cur = Math.floor(Math.random() * 9) + 3;
        let nxt = Math.floor(Math.random() * 13) + 1;
        while (nxt === cur) nxt = Math.floor(Math.random() * 13) + 1;
        gameData.cardCurrent = cur; gameData.cardNext = nxt;
        io.emit('syncGame', gameData);
    });
    socket.on('pickCard', (dir) => {
        if (gameData.gameState !== 'cards') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        const won = (dir === 'higher' && gameData.cardNext > gameData.cardCurrent) || (dir === 'lower' && gameData.cardNext < gameData.cardCurrent);
        if (won) {
            if (isA) { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (Next card was ${gameData.cardNext}!)`, '🃏', gameData.captainA.username, "🃏 Card Shark"); }
            else { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (Next card was ${gameData.cardNext}!)`, '🃏', gameData.captainB.username, "🃏 Card Shark"); }
        } else {
            if (isA) { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (Red guessed wrong: ${gameData.cardNext})`, '🃏', gameData.captainB.username); }
            else { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (Blue guessed wrong: ${gameData.cardNext})`, '🃏', gameData.captainA.username); }
        }
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    });

    socket.on('launchDefuse', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers(); gameData.gameState = 'defuse';
        const types = ['SAFE', 'SAFE', 'DEFUSE', 'BOOM'].sort(() => Math.random() - 0.5);
        const colors = ['🔴 RED WIRE', '🔵 BLUE WIRE', '🟢 GREEN WIRE', '🟡 YELLOW WIRE'];
        gameData.defuseWires = colors.map((label, i) => ({ label, type: types[i], cut: false }));
        gameData.defuseTurn = gameData.captainA.id;
        io.emit('syncGame', gameData);
    });
    socket.on('cutWire', (idx) => {
        if (gameData.gameState !== 'defuse' || socket.id !== gameData.defuseTurn) return;
        const wire = gameData.defuseWires[idx];
        if (!wire || wire.cut) return;
        wire.cut = true;
        const isA = socket.id === gameData.captainA.id;
        if (wire.type === 'DEFUSE') {
            if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Defused the Bomb! ✂️)", '💣', gameData.captainA.username, "💣 Bomb Defuser"); }
            else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Defused the Bomb! ✂️)", '💣', gameData.captainB.username, "💣 Bomb Defuser"); }
            gameData.gameState = 'lobby';
        } else if (wire.type === 'BOOM') {
            if (isA) { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Red cut the BOOM wire! 💥)", '💥', gameData.captainB.username); }
            else { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Blue cut the BOOM wire! 💥)", '💥', gameData.captainA.username); }
            gameData.gameState = 'lobby';
        } else {
            gameData.defuseTurn = isA ? gameData.captainB.id : gameData.captainA.id;
        }
        io.emit('syncGame', gameData);
    });

    socket.on('launchGuess', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers(); gameData.gameState = 'guess';
        gameData.guessSecret = Math.floor(Math.random() * 100) + 1;
        gameData.guessHint = 'Guess a number between 1 and 100!';
        io.emit('syncGame', gameData);
    });
    socket.on('submitGuess', (num) => {
        if (gameData.gameState !== 'guess') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        const g = Number(num);
        if (g === gameData.guessSecret) {
            if (isA) { gameData.scores.teamA++; recordWin(`${gameData.captainA.username} (Nailed ${g}!)`, '🔢', gameData.captainA.username, "🔢 Mind Reader"); }
            else { gameData.scores.teamB++; recordWin(`${gameData.captainB.username} (Nailed ${g}!)`, '🔢', gameData.captainB.username, "🔢 Mind Reader"); }
            gameData.gameState = 'lobby';
        } else if (g < gameData.guessSecret) {
            gameData.guessHint = `📈 ${g} is TOO LOW! Go Higher!`;
        } else {
            gameData.guessHint = `📉 ${g} is TOO HIGH! Go Lower!`;
        }
        io.emit('syncGame', gameData);
    });

    socket.on('launchTarget', () => {
        if (socket.id !== hostId) return;
        ensureCaptains(); clearAllTimers(); gameData.gameState = 'target';
        gameData.targetPos = { x: Math.floor(Math.random() * 70) + 15, y: Math.floor(Math.random() * 70) + 15 };
        io.emit('syncGame', gameData);
    });
    socket.on('hitTarget', () => {
        if (gameData.gameState !== 'target') return;
        const isA = gameData.captainA && socket.id === gameData.captainA.id, isB = gameData.captainB && socket.id === gameData.captainB.id;
        if (!isA && !isB) return;
        if (isA) { gameData.scores.teamA++; recordWin(gameData.captainA.username + " (Bullseye Sniper!)", '🎯', gameData.captainA.username, "🎯 Sharp Sniper"); }
        else { gameData.scores.teamB++; recordWin(gameData.captainB.username + " (Bullseye Sniper!)", '🎯', gameData.captainB.username, "🎯 Sharp Sniper"); }
        gameData.gameState = 'lobby'; io.emit('syncGame', gameData);
    });
    socket.on('launchSTK', (killerId) => {
        if (socket.id !== hostId || players.length < 1) return;
        clearAllTimers();
        const chosenKiller = players.find(p => p.id === killerId) || players.find(p => p.id !== hostId) || players;
        const stkPlayers = {};
        players.forEach((p, idx) => {
            const isKiller = (p.id === chosenKiller.id);
            const isHostSpectator = (p.id === hostId && !isKiller && players.length > 2);
            stkPlayers[p.id] = {
                id: p.id, username: p.username, avatar: p.avatar,
                role: isKiller ? 'killer' : (isHostSpectator ? 'spectator' : 'survivor'),
                x: isKiller ? 0 : (Math.cos(idx * 1.5) * 12),
                y: isHostSpectator ? 12 : 1,
                z: isKiller ? 0 : (Math.sin(idx * 1.5) * 12),
                rotY: 0, status: 'alive', bleedTimer: 15, flying: isHostSpectator
            };
        });
        gameData.stkState = { timeLeft: 60, exitOpen: false, exitPos: { x: 0, z: -18 }, players: stkPlayers };
        gameData.gameState = 'stk';
        io.emit('syncGame', gameData);

        stkInterval = setInterval(() => {
            if (gameData.gameState !== 'stk' || !gameData.stkState) { clearInterval(stkInterval); return; }
            const st = gameData.stkState;
            st.timeLeft--;
            if (st.timeLeft <= 15) st.exitOpen = true;

            Object.values(st.players).forEach(pl => {
                if (pl.role === 'survivor' && pl.status === 'downed') {
                    pl.bleedTimer--;
                    if (pl.bleedTimer <= 0) pl.status = 'dead';
                }
            });

            const survivors = Object.values(st.players).filter(p => p.role === 'survivor');
            const activeSurvivors = survivors.filter(p => p.status === 'alive' || p.status === 'downed');
            const escapedSurvivors = survivors.filter(p => p.status === 'escaped');
            const killer = Object.values(st.players).find(p => p.role === 'killer');

            if (survivors.length > 0 && activeSurvivors.length === 0) {
                clearInterval(stkInterval);
                if (escapedSurvivors.length > 0) {
                    const names = escapedSurvivors.map(s => s.username).join(', ');
                    escapedSurvivors.forEach(s => { addMVPPoints(s.username, 3); awardTrophy(s.username, "🏃‍♂️ Escape Artist"); });
                    recordWin(`Survivors Escaped (${names})! 🚪`, '🏃‍♂️', escapedSurvivors.username);
                } else {
                    if (killer) { addMVPPoints(killer.username, 4); awardTrophy(killer.username, "🔪 Slasher Legend"); }
                    recordWin(`Killer ${killer ? killer.username : ''} Eliminated Everyone! 🔪`, '🔪', killer ? killer.username : null);
                }
                gameData.gameState = 'lobby'; gameData.stkState = null; io.emit('syncGame', gameData);
                return;
            }

            if (st.timeLeft <= 0) {
                clearInterval(stkInterval);
                const winners = survivors.filter(s => s.status === 'alive' || s.status === 'escaped');
                if (winners.length > 0) {
                    winners.forEach(s => { addMVPPoints(s.username, 3); awardTrophy(s.username, "🏃‍♂️ Escape Artist"); });
                    recordWin(`Survivors Survived the Night! 🌅`, '🏃‍♂️', winners.username);
                } else {
                    if (killer) { addMVPPoints(killer.username, 4); awardTrophy(killer.username, "🔪 Slasher Legend"); }
                    recordWin(`Killer ${killer ? killer.username : ''} Won! 🔪`, '🔪', killer ? killer.username : null);
                }
                gameData.gameState = 'lobby'; gameData.stkState = null; io.emit('syncGame', gameData);
                return;
            }
            io.emit('stkTick', st);
        }, 1000);
    });
    socket.on('stkMove', (pos) => {
        if (gameData.gameState !== 'stk' || !gameData.stkState || !gameData.stkState.players[socket.id]) return;
        const p = gameData.stkState.players[socket.id];
        if (p.status === 'dead' || p.status === 'escaped') return;
        p.x = Math.max(-19, Math.min(19, Number(pos.x) || 0));
        p.z = Math.max(-19, Math.min(19, Number(pos.z) || 0));
        if (socket.id === hostId && typeof pos.y === 'number') p.y = Math.max(1, Math.min(22, pos.y));
        p.rotY = Number(pos.rotY) || 0;

        if (p.role === 'survivor' && p.status === 'alive' && gameData.stkState.exitOpen) {
            const distExit = Math.hypot(p.x - gameData.stkState.exitPos.x, p.z - gameData.stkState.exitPos.z);
            if (distExit < 3.2) {
                p.status = 'escaped';
                io.emit('message', { username: "Sammu's Bot", text: `🚪 **${p.username}** escaped through the Exit Gate!` });
            }
        }
        io.emit('stkTick', gameData.stkState);
    });

    socket.on('stkAction', (actionType) => {
        if (gameData.gameState !== 'stk' || !gameData.stkState || !gameData.stkState.players[socket.id]) return;
        const actor = gameData.stkState.players[socket.id];
        const allPlayers = Object.values(gameData.stkState.players);

        if (actionType === 'slash' && actor.role === 'killer') {
            allPlayers.forEach(target => {
                if (target.role === 'survivor' && target.status === 'alive') {
                    const dist = Math.hypot(actor.x - target.x, actor.z - target.z);
                    if (dist <= 3.8) {
                        target.status = 'downed';
                        target.bleedTimer = 15;
                        io.emit('message', { username: "Sammu's Bot", text: `🩸 **${actor.username}** slashed **${target.username}**! Survivors have 15s to REVIVE!` });
                    }
                }
            });
            io.emit('stkTick', gameData.stkState);
        } else if (actionType === 'revive' && actor.role === 'survivor' && actor.status === 'alive') {
            allPlayers.forEach(target => {
                if (target.role === 'survivor' && target.status === 'downed' && target.id !== actor.id) {
                    const dist = Math.hypot(actor.x - target.x, actor.z - target.z);
                    if (dist <= 3.8) {
                        target.status = 'alive';
                        target.bleedTimer = 15;
                        addMVPPoints(actor.username, 1);
                        io.emit('message', { username: "Sammu's Bot", text: `❤️‍🩹 **${actor.username}** revived **${target.username}**! (+1 MVP pt)` });
                    }
                }
            });
            io.emit('stkTick', gameData.stkState);
        }
    });

    socket.on('sendReaction', (emoji) => io.emit('incomingReaction', emoji));

    socket.on('resetToLobby', () => {
        if (socket.id !== hostId) return;
        clearAllTimers(); spinnerEnded = false;
        gameData = {
            captainA: null, captainB: null, teamA: [], teamB: [],
            fighterA: null, fighterB: null, tttBoard: Array(9).fill(null), tttTurn: null,
            sumoPosition: 50,
            spinner: { a: { x: 80, y: 130, vx: 0, vy: 0 }, b: { x: 180, y: 130, vx: 0, vy: 0 } },
            drawReady: false, mathQ: { question: '', options: [], answer: 0 },
            bombHolder: null, rpsChoices: { a: null, b: null },
            memoryGrid: [], memoryTarget: '', memoryHidden: false,
            tugPosition: 50, colorTrap: null, scrambleWord: '', scrambleAnswer: '',
            diceRolls: { a: null, b: null }, penaltyPicks: { shooter: null, keeper: null },
            typingPhrase: '', treasureGrid: [],
            simonCommand: '', simonIsValid: false, cardCurrent: 7, cardNext: 0,
            defuseWires: [], defuseTurn: null, guessSecret: 50, guessHint: 'Guess 1 - 100!',
            targetPos: { x: 50, y: 50 }, stkState: null,
            scores: gameData.scores, gameState: 'lobby'
        };
        io.emit('syncGame', gameData);
    });

    socket.on('disconnect', () => {
        const lp = players.find(p => p.id === socket.id);
        if (lp) io.emit('message', { username: "Sammu's Bot", text: `😢 ${lp.username} has left the room` });
        players = players.filter(p => p.id !== socket.id);
        io.emit('updatePlayers', players);
    });
});
function checkWin(b) {
    return ["012","345","678","036","147","258","048","246"].some(s => { const [x,y,z] = s.split('').map(Number); return b[x] && b[x] === b[y] && b[x] === b[z]; });
}

setInterval(() => {
    try {
        if (gameData.gameState !== 'spinner') { spinnerEnded = false; return; }
        if (spinnerEnded || !gameData.spinner || !gameData.spinner.a || !gameData.spinner.b) return;

        const a = gameData.spinner.a, b = gameData.spinner.b;
        a.x += a.vx; a.y += a.vy; a.vx *= 0.88; a.vy *= 0.88;
        b.x += b.vx; b.y += b.vy; b.vx *= 0.88; b.vy *= 0.88;

        const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
        if (dist < 40) {
            const nx = dist > 0 ? dx / dist : 1, ny = dist > 0 ? dy / dist : 0, overlap = 40 - dist;
            a.x -= nx * (overlap / 2); a.y -= ny * (overlap / 2);
            b.x += nx * (overlap / 2); b.y += ny * (overlap / 2);
            a.vx -= nx * 11; a.vy -= ny * 11; b.vx += nx * 11; b.vy += ny * 11;
        }

        const distA = Math.hypot(a.x - 130, a.y - 130), distB = Math.hypot(b.x - 130, b.y - 130);
        if (distA >= 106 || distB >= 106) {
            spinnerEnded = true; gameData.gameState = 'lobby';
            const capAName = gameData.captainA ? gameData.captainA.username : "Red Spinner";
            const capBName = gameData.captainB ? gameData.captainB.username : "Blue Spinner";
            if (distA >= distB) {
                gameData.scores.teamB++;
                recordWin(capBName + " (🔵 Team B)", '🌀', capBName, "🌀 Spinner Pro");
            } else {
                gameData.scores.teamA++;
                recordWin(capAName + " (🔴 Team A)", '🌀', capAName, "🌀 Spinner Pro");
            }
            io.emit('syncGame', gameData);
        } else {
            io.emit('spinnerTick', gameData.spinner);
        }
    } catch (err) {
        gameData.gameState = 'lobby';
        io.emit('syncGame', gameData);
    }
}, 33);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Sammu Games Running on Port ' + PORT));
