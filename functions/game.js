exports.handler = async function(context, event, callback) {
  const Game = require(Runtime.getAssets()['/Game.js'].path);
  const playerId = event.From;
  const baldertextGame = new Game({context, gameNumber: event.To});
  await baldertextGame.load();

  let message = event.Body ? event.Body : '';
  let normalizedMessage = message.toLowerCase().trim();
  const twiml = new Twilio.twiml.MessagingResponse();

  if (normalizedMessage.startsWith('join game')) {
    if (baldertextGame.gameData.state === 'pending') {
      let username =  message.replace(/join game/i, '').trim();
      let numPlayers = await baldertextGame.addPlayer(playerId, username);
      if (numPlayers === 1) {
        twiml.message("Sure! Respond with 'Start game' when everyone has joined.")
      } else {
        twiml.message("Awesome, you're in! The game will start when everyone has joined")
      }

    } else {
      twiml.message("Sorry, this game is already in progress...check back later to join a new game!")
    }

  } else if (normalizedMessage === 'start game') {
    await baldertextGame.startRound();
    return callback();

  } else if (normalizedMessage.startsWith('definition')) {
    await baldertextGame.logResponse('definition', playerId, message);
    const response = await baldertextGame.checkRound('definition', playerId);
    if (response) {
      twiml.message(response);
      return callback(null, twiml)
    } else { return callback() }

  // Should keep track of each player's state to log responses instead of parsing message string
  } else if (!Number.isNaN(parseInt(message.trim()))) {
    await baldertextGame.logResponse('vote', playerId, message);
    const response = await baldertextGame.checkRound('vote', playerId);
    if (response) {
      twiml.message(response);
      return callback(null, twiml)
    } else { return callback() }

  } else if (normalizedMessage === 'end game') {
    await baldertextGame.removeGame();
    twiml.message("Ok! I've removed your active game. Respond with 'join game' to start a new game.")

  } else {
    twiml.message("Hmm, I'm not sure how to do that. Respond with 'Create game' if you want to play a game of Baldertext!")
  }

  return callback(null, twiml)
}
