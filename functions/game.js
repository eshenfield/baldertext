async = require('async')
exports.handler = async function(context, event, callback) {
  const Game = require(Runtime.getAssets()['/Game.js'].path);
  const playerId = event.From;
  const baldertextGame = new Game({context, gameNumber: event.To});
  await baldertextGame.load();

  const response = await baldertextGame.handlePlayerInput(playerId, event.Body)
  await baldertextGame.update(response.updates);
  await sendMessage(context, baldertextGame.gameNumber, response);
  return callback();
}

const sendMessage = async function(context, gameNumber, message) {
  twilioClient = context.getTwilioClient();
  async.each(message.to, async (number) => {
    await this.twilioClient.messages
      .create({
        body: message.text,
        from: gameNumber,
        to: number
      })
    return;
  }, (err) => {
    if (err) throw err;
  })
}
