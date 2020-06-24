async = require('async')
exports.handler = async function(context, event, callback) {
  const Game = require(Runtime.getAssets()['/Game.js'].path);
  const playerId = event.From;
  const baldertextGame = new Game({context, gameNumber: event.To});
  await baldertextGame.load();

  const response = await baldertextGame.handlePlayerInput(playerId, event.Body)
  await baldertextGame.update();

  async.each(response.to, (number, asyncCb) => {
    context.getTwilioClient().messages.create({
      body: response.text,
      from: baldertextGame.gameNumber,
      to: number
    }).then(asyncCb);
  }, (results, err) => {
    return callback(err);
  });
}
