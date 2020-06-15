const async = require('async');
const axios = require('axios');
const balderdashWords = require(Runtime.getAssets()['/balderdash-words.js'].path);

class Game {
  constructor(options) {
    this.context = options.context;
    this.twilioClient = options.context.getTwilioClient();
    this.name = 'baldertext';
    this.gameNumber = options.gameNumber;
    this.numRounds = 3;
  }

  async load() {
    try {
      const game = await this.fetch();
    } catch (err) {
      if (err.status === 404) {
        await this.init();
      } else {
        throw err;
      }
    }
  }

  async init() {
    let initData = {
      state: 'pending',
      numCompletedRounds: 0,
      scores: {},
      playerIdToUserName: {},
      currentRound: {
        word: null,
        definition: null,
        definitionIdx: null,
        responses: [],
        numDefinitionsSubmit: 0,
        numVotesSubmit: 0
      },
      seenWords: []
    }

    return twilioClient.sync.services(this.context.SYNC_SERVICE_SID)
      .documents
      .create({uniqueName: this.name, data: initData})
      .then((game) => {
        this.gameData = game.data;
        return game;
      })
      .catch((err) => {
        throw err
      });
  }

  async fetch() {
    return twilioClient.sync.services(this.context.SYNC_SERVICE_SID)
      .documents(this.name)
      .fetch()
      .then((game) => {
        this.gameData = game.data;
        return game;
      })
      .catch((err) => {
        throw err
      });
  }

  async addPlayer(playerId, username) {
    this.gameData.scores[playerId] = 0;
    username = username ? username : playerId;
    this.gameData.playerIdToUserName[playerId] = username;
    const numPlayers = Object.keys(this.gameData.scores).length;
    return this._updateGame().then(() => Promise.resolve(numPlayers))
  }

  async startRound() {
    this.gameData.state = 'active';
    this.gameData.currentRound.definitionIdx = Math.floor(Math.random() * Object.keys(this.gameData.scores).length + 1);

    let wordIdx = Math.floor(Math.random() * balderdashWords.length);
    while (this.gameData.seenWords.indexOf(balderdashWords[wordIdx]) > -1) {
      wordIdx = Math.floor(Math.random() * balderdashWords.length);
    }
    this.gameData.currentRound.word = balderdashWords[wordIdx];

    let definitionsResponse;
    try {
      definitionsResponse = await axios.get(getWordnikUrl(balderdashWords[wordIdx], this.context.WORDNIK_API_KEY));
    } catch (err) {
      // TODO: If error is 404, just try again with a different word
      throw err;
    }

    for (let definition of definitionsResponse.data) {
      if (definition.text) {
        // HACK: Some definitions include a limited set of html tags. Because we generally don't
        // expect the definitions to have other carets, we naively strip tags from the string.
        this.gameData.currentRound.definition = definition.text.replace(/<([^>]+)>/ig, '');
        break;
      }
    }

    return this._updateGame().then(() => {
      const message = `Round #${this.gameData.numCompletedRounds + 1}: Respond with your most convincing definition for the word:
        '${this.gameData.currentRound.word}'. Be sure to start your response with 'Definition'.`
      return this._sendToAllPlayers(message);
    })
  }

  async logResponse(responseType, playerId, message) {
    if (responseType === 'definition') {
      const definition = message.replace(/definition/i, '').trim();

      if (this.gameData.currentRound.responses.length === this.gameData.currentRound.definitionIdx - 1) {
        this.gameData.currentRound.responses.push({
          playerId: 'true',
          definition: this.gameData.currentRound.definition,
          votes: []
        });
      }

      this.gameData.currentRound.numDefinitionsSubmit++;
      this.gameData.currentRound.responses.push({
        playerId: playerId,
        definition: definition,
        votes: []
      });

      return this._updateGame();

    } else if (responseType === 'vote') {
      const voteIdx = parseInt(message.trim()) - 1;
      this.gameData.currentRound.numVotesSubmit++;
      this.gameData.currentRound.responses[voteIdx].votes.push(playerId)
      return this._updateGame();
    } else {
      throw new Error(`Invalid responseType ${responseType}`)
    }
  }

  async checkRound(roundPhase) {
    if (roundPhase === 'definition') {
      const isLastPlayer = this.gameData.currentRound.numDefinitionsSubmit === Object.keys(this.gameData.scores).length;
      const responses = this.gameData.currentRound.responses
      if (isLastPlayer) {
        let definitions = '';
        // Could add real definition here and then shuffle array. Downside is I don't update the game at all during the "check round" phase and I'd have to in order to do this
        responses.forEach((response, index) => {
          definitions += `${index + 1}: ${response.definition}\n`
        });
        this._sendToAllPlayers("Vote for the definition you think is real by responding with the number of your choice.")
        await sleep();
        await this._sendToAllPlayers(definitions);
      } else {
        return "Roger that, I've logged your definition. Keep an eye out for the voting round!"
      }
    } else if (roundPhase === 'vote') {
      const isLastPlayer = this.gameData.currentRound.numVotesSubmit === Object.keys(this.gameData.scores).length;
      if (isLastPlayer) {
        await this._scoreRound();
        let roundSummary = `The real answer was: ${this.gameData.currentRound.definition}\n`
        roundSummary += 'Scores:\n'
        for (let playerId in this.gameData.scores) {
          roundSummary += `${this.gameData.playerIdToUserName[playerId]}: ${this.gameData.scores[playerId]}\n`
        }
        await this._sendToAllPlayers(roundSummary);
        await sleep();
        if (this.gameData.numCompletedRounds === this.numRounds) {
          await this._sendToAllPlayers(`Aaand the final results are in...the winner is ${this.gameData.playerIdToUserName[this.gameData.rankings[0]]}!`)
          await this.removeGame();
        } else {
          await this._resetRound();
          await this.startRound();
        }
      } else {
        return "Thanks for that...I'll score this round and let you know the results in a jif!"
      }
    } else {
      throw new Error(`Invalid roundPhase ${roundPhase}`)
    }
  }

  async removeGame() {
    this.twilioClient.sync.services(this.context.SYNC_SERVICE_SID)
      .documents(this.name)
      .remove()
      .then(() => {
        return
      })
  }

  async _resetRound() {
    this.gameData.numCompletedRounds++;
    this.gameData.seenWords.push(this.gameData.currentRound.word);
    this.gameData.currentRound = {
      word: null,
      definition: null,
      definitionIdx: null,
      responses: [],
      numDefinitionsSubmit: 0,
      numVotesSubmit: 0
    }

    return this._updateGame();
  }

  async _sendToAllPlayers(message) {
    const playerNumbers = Object.keys(this.gameData.scores);
    async.each(playerNumbers, async (number) => {
      await this.twilioClient.messages
        .create({
          body: message,
          from: this.gameNumber,
          to: number
        })
      return true
    }, (err) => {
      if (err) throw err
    })
  }

  async _scoreRound() {
    for (let response of this.gameData.currentRound.responses) {
      if (response.playerId === 'true') {
        for (let voterId of response.votes) {
          this.gameData.scores[voterId] += 2;
        }
      } else {
        this.gameData.scores[response.playerId] += response.votes.length;
      }
    }

    this.gameData.rankings = Object.keys(this.gameData.scores)
      .sort((a, b) => {return this.gameData.scores[b] - this.gameData.scores[a]})

    return this._updateGame()
  }

  _updateGame() {
    // TODO: Only update changed fields to avoid race condition concurrency issues.
    return twilioClient.sync.services(this.context.SYNC_SERVICE_SID)
      .documents(this.name)
      .update({data: this.gameData})
      .then((game) => {
        this.gameData = game.data;
        return Promise.resolve(this.gameData);
      })
      .catch((err) => {
        throw err;
      });
  }
}

module.exports = Game;

function getWordnikUrl(word, key) {
    return `https://api.wordnik.com/v4/word.json/${word}/definitions?limit=200&includeRelated=false&sourceDictionaries=all&useCanonical=false&includeTags=false&api_key=${key}`;
}

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sleep() {
  await timeout(3000);
  return;
}
