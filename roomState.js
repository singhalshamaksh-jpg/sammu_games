// roomState.js
const serverRooms = new Map();

function createRoomState(srvId) {
  return {
    id: srvId,
    players: [],
    hostId: null,
    hostUsername: null,
    spinnerEnded: false,
    skincareSession: null,
    activeMysteryBox: null,
    timers: { draw: null, bomb: null, memory: null, simon: null, tourney: null, reflex: null, mystery: null },
    botMemory: {
      lastWinner: null, winStreaks: {}, playerPoints: {}, trophies: {},
      activeQuiz: null, activeRiddle: null, activeTask: null, activeMovie: null,
      activeUnscramble: null, activeWordChain: null, customTask: null,
      ayurvedaPatients: new Set(), legendaryGallery: [], chatCount: 0
    },
    tourneyState: {
      active: false, round: 0, maxGames: 15, gamesPlayed: 0,
      queue: [], nextRound: [], eliminated: [], matchScores: {}, currentPair: null
    },
    gameData: {
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
      targetPos: { x: 50, y: 50 }, stkState: null, reflexGreen: false,
      scores: { teamA: 0, teamB: 0 }, gameState: 'lobby'
    }
  };
}

function getRoom(srvId) {
  const key = String(srvId || 'global');
  if (!serverRooms.has(key)) serverRooms.set(key, createRoomState(key));
  return serverRooms.get(key);
}

function deleteRoom(srvId) {
  const room = serverRooms.get(String(srvId));
  if (room) {
    Object.values(room.timers).forEach(t => { if (t) clearTimeout(t); });
    serverRooms.delete(String(srvId));
  }
}

module.exports = { serverRooms, getRoom, deleteRoom };
                     
