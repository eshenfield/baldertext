const _ = require('lodash');
const axios = require('axios');
const balderdashWords = require(Runtime.getAssets()['/balderdash-words.js'].path);

const INIT_GAME_DATA = {
  state: 'pending',
  players: {},
  currentRound: {},
  seenWords: [],
  numCompletedRounds: 0
}

const INIT_ROUND_DATA = {
  word: null,
  definition: null,
  responses: []
}

class Game {
  constructor(options) {
    this.context = options.context;
    this.twilioClient = options.context.getTwilioClient();
    this.gameNumber = options.gameNumber;

    this.name = 'baldertext';
    this.syncSID = 'default';
    this.totalNumRounds = 3;
    this.maxPlayers = 8;
    this.minPlayers = 2;
  }

  async load() {
    try {
      await this._fetch();
    } catch (err) {
      if (err.status === 404) {
        await this._init();
      } else {
        throw err;
      }
    }
  }

  async handlePlayerInput(playerId, input) {
    const allPlayerNumbers = Object.keys(this.data.players);
    const player = this.data.players[playerId];

    if (input.match(/join game/i)) {
      if (player) {
        return {
          to: [playerId],
          text: "You're already a part of this game! Respond with 'Start game' if you're ready to play."
        }
      }
      return {
        to: [playerId],
        text: this._addPlayer(playerId, input.replace(/join game/i, '').trim())
      }

    } else if (input.match(/start game/i)) {
      if (!player || !player.state === 'waiting') {
        return {
          to: [playerId],
          text: "Whoops, looks like you're either not part of an active game, or the game has already started!"
        }
      }
      const text = await this._startGame();
      const to = allPlayerNumbers
      return {text, to};

    } else if (input.match(/end game/i)) {
      return { text: this._endGame(), to: allPlayerNumbers }
    }

    let response = {};
    switch (player.state) {
      case 'defining':
        this._logResponse('definition', playerId, input);
        player.state = 'voting';
        response.text = "Roger that, I've logged your definition!"
        response.to = [playerId]
        break;
      case 'voting':
        this._logResponse('vote', playerId, input);
        player.state = 'waiting';
        response.text = "Got it. Your vote is in the books!"
        response.to = [playerId]
        break;
    }

    if (this._isGamePhaseComplete()) {
      switch (this.data.state) {
        case 'defining':
          response.text = this._startVoting();
          response.to = allPlayerNumbers
          break;
        case 'voting':
          response.text = this._scoreRound();
          response.to = allPlayerNumbers

          if (this.data.numCompletedRounds >= this.totalNumRounds) {
            response.text += '\n';
            response.text += this._endGame();
          } else {
            response.text += '\n'
            this.data.numCompletedRounds += 1;
            response.text += await this._startRound();
          }
          break;
      }
    }

    return response;
  }

  _isGamePhaseComplete() {
    switch (this.data.state) {
      case 'pending':
        return false;
      case 'defining':
        return _.every(this.data.players, {state: 'voting'});
      case 'voting':
        return _.every(this.data.players, {state: 'waiting'});
      default:
        throw new Error(`Invalid game state: ${this.data.state}`)
    }
  }

  _startVoting() {
    this.data.state = 'voting';
    this.data.currentRound.responses.push({
      playerId: 'realDefinition',
      definition: this.data.currentRound.definition,
      votes: []
    });

    this.data.currentRound.responses = _.shuffle(this.data.currentRound.responses);

    let definitionsMessage = 'Vote for the definition you think is real by responding with the number of your choice.\n';
    this.data.currentRound.responses.forEach((response, index) => {
      definitionsMessage += `${index + 1}: ${response.definition}\n`;
    });

    return definitionsMessage;
  }

  _startVoting() {
    this.data.state = 'voting';
    this.data.currentRound.responses.push({
      playerId: 'realDefinition',
      definition: this.data.currentRound.definition,
      votes: []
    });

    this.data.currentRound.responses = _.shuffle(this.data.currentRound.responses);

    let definitionsMessage = 'Vote for the definition you think is real by responding with the number of your choice.\n';
    this.data.currentRound.responses.forEach((response, index) => {
      definitionsMessage += `${index + 1}: ${response.definition}\n`;
    });

    return definitionsMessage;
  }

  _scoreRound() {
    for (let response of this.data.currentRound.responses) {
      if (response.playerId === 'realDefinition') {
        for (let voterId of response.votes) {
          this.data.players[voterId].score += 2;
        }
      } else {
        this.data.players[response.playerId].score += response.votes.length;
      }
    }

    this.data.rankings = Object.keys(this.data.players)
      .sort((a, b) => {return this.data.players[b].score - this.data.players[a].score});

    let roundSummary = `The real answer was: ${this.data.currentRound.definition}\n`;
    roundSummary += 'The scores after this round are:\n';
    for (let playerId in this.data.players) {
      const player = this.data.players[playerId];
      roundSummary += `${player.username}: ${player.score}\n`;
    }

    return roundSummary;
  }

  _endGame() {
    let message;
    if (this.data.state === 'pending') {
      message = "There's no active game to end! Respond with 'Join game' to join a new game.";
    } else if (this.data.rankings) {
      message = `And the final results are in! The winner of this game is...\n\n${this.data.players[this.data.rankings[0]].username}! Congratulations, you're a real wordsmith!`
    } else {
      message = "Got it -- I've ended the game. Respond with 'Join game' to join a new game."
    }

    this.data = _.cloneDeep(INIT_GAME_DATA);
    return message;
  }

  _addPlayer(playerId, username) {
    if (this.data.players[playerId]) {
      return "You're already in! Respond with 'Start game' to get this show on the road."
    } else if (Object.keys(this.data.players).length === this.maxPlayers) {
      return "This game is already full! Try joining for the next game."
    }

    this.data.players[playerId] = {
      username: username || playerId,
      score: 0,
      state: 'waiting'
    }

    return "You're in! Respond with 'start game' when all players have joined."
  }

  _setPlayerStates(state) {
    for (let playerId in this.data.players) {
      this.data.players[playerId].state = state;
    }
  }

  async _startGame() {
    if (Object.keys(this.data.players).length < this.minPlayers) {
      return `There aren't enough players yet to start a game! Make sure you have at least ${this.minPlayers} to play.`
    }
    return this._startRound();
  }

  async _startRound() {
    this.data.currentRound = _.cloneDeep(INIT_ROUND_DATA);
    this.data.state = 'defining';
    this._setPlayerStates('defining');
    await this._setRoundWord();

    return `Round #${this.data.numCompletedRounds + 1}: Respond with your most convincing definition for the word:
      '${this.data.currentRound.word}'.`;
  }

  async _setRoundWord() {
    let wordAndDefinition = {};
    while (!wordAndDefinition.word) {
      try {
        wordAndDefinition = await this._getWordAndDefinition();
      } catch {
        continue;
      }
    }
    this.data.currentRound.word = wordAndDefinition.word;
    this.data.currentRound.definition = wordAndDefinition.definition;
    return;
  }

  async _getWordAndDefinition() {
    let word, definitionResponse, definition;
    let wordIdx = Math.floor(Math.random() * balderdashWords.length);

    while (this.data.seenWords.indexOf(balderdashWords[wordIdx]) > -1) {
      wordIdx = Math.floor(Math.random() * balderdashWords.length);
    }
    word = balderdashWords[wordIdx];

    try {
      let axiosOptions = getAxiosOptions(word, {
        appId: this.context.OXFORD_APP_ID,
        appKey: this.context.OXFORD_APP_KEY
      })
      definitionResponse = await axios.get(axiosOptions.url, {headers: axiosOptions.headers});
      definition = parseDefinition(definitionResponse.data);
    } catch (err) {
      console.log(`Couldn't get definition for word: ${word}`)
      this.data.seenWords.push(word)
      throw err;
    }

    return {word, definition}
  }

  _logResponse(responseType, playerId, message) {
    switch (responseType) {
      case 'definition':
        this.data.currentRound.responses.push({
          playerId,
          definition: message,
          votes: []
        });
        break;
      case 'vote':
        const voteIdx = parseInt(message) - 1;
        this.data.currentRound.responses[voteIdx].votes.push(playerId);
        break;
      default:
        throw new Error(`Invalid responseType: ${responseType}`);
    }
    return;
  }

  async _init() {
    return twilioClient.sync.services(this.syncSID)
      .documents
      .create({uniqueName: this.name, data: _.cloneDeep(INIT_GAME_DATA)})
      .then((game) => {
        this.data = game.data;
        return game;
      })
      .catch((err) => {
        throw err;
      });
  }

  async _fetch() {
    return twilioClient.sync.services(this.syncSID)
      .documents(this.name)
      .fetch()
      .then((game) => {
        this.data = game.data;
        return game;
      })
      .catch((err) => {
        throw err;
      });
  }

  // TODO: Can we make these updates granular instead of overwriting full data object every time?
  async update() {
    return twilioClient.sync.services(this.syncSID)
      .documents(this.name)
      .update({data: this.data})
      .then((game) => {
        this.data = game.data;
        return Promise.resolve(this.data);
      })
      .catch((err) => {
        throw err;
      });
  }
}

module.exports = Game;

function getAxiosOptions(word, credentials) {
  return {
    url: `https://od-api.oxforddictionaries.com/api/v2/entries/en-gb/${word}?fields=definitions&strictMatch=false`,
    headers: {
      app_id: credentials.appId,
      app_key: credentials.appKey
    }
  }
}

function parseDefinition(data) {
  for (let result of data.results) {
    for (let lexicalEntry of result.lexicalEntries) {
      for (let entry of lexicalEntry.entries) {
        for (let sense of entry.senses) {
          if (sense.definitions.length > 0) {
            return sense.definitions[0];
          }
        }
      }
    }
  }
  throw new Error("Couldn't parse definition")
}
