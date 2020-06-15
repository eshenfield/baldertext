# Baldertext

BalderText is an SMS-variant of a classic board game named [Balderdash](https://en.wikipedia.org/wiki/Balderdash). It offers an additional way to engage with friends and family from a distance. The game is built in JavaScript using [Twilio Functions](https://www.twilio.com/docs/runtime/functions-assets-api) and can be easily deployed using the [Serverless toolkit](https://www.twilio.com/docs/labs/serverless-toolkit).

To play with your own group, follow the instructions below in [Deploy your own BalderText game](#deploy-your-own-baldertext-game) and use the [Gameplay](#gameplay) instructions to get started quickly.

## Gameplay

### Objective
The goal of BalderText is to write a fake definition for an uncommon word that is convincing enough that the other players believe it is the real definition. Players receive points when other players choose their fake definitions and when they successfully choose the real definition. After 4 rounds, the player with the most points wins!

### Scoring
Each player who chooses the real definition gets `2 points`
<br>
Each player gets `1 point` for every other player who chooses their fake definition

### How to Play
BalderText supports 2-8 players.
1. Every player texts ‘Join game’ to your game number with a username. When all players have joined, one player kicks off the game by texting ‘Start game’ to the game number.
2. All players receive the same word in a text, with a prompt to generate a fake definition for the word that other players will be likely to pick. The players are prompted to respond with ‘Definition ______’ (including their made-up definition).
3. Once everyone has submitted their fake definition, all players receive every submitted definition as well as the real definition (in random order). Each player votes on which definition they think is the real one.
4. After scoring, the round ends and the game sends a score summary to each player before starting the next round.
5. After 4 rounds, the game ends and the player with the most points wins.

### Commands
These are the commands you can text to your configured BalderText number:

<table>
  <tr>
    <th>Command</th>
    <th>What does it do?</th>
  </tr>
  <tr>
    <td><code>Join game &ltusername></code></td>
    <td>Adds the messager to the game as the provided username, or as their phone number if no username is provided.</td>
  </tr>
  <tr>
    <td><code>Start game</code></td>
    <td>Begins the first round of gameplay. No new players can join the game while it is active.</td>
  </tr>
  <tr>
    <td><code>End game</code></td>
    <td>Stops and removes the active game, if there is one. Players have to rejoin using the <code>Join game</code> command before starting a new game.</td>
  </tr>
  <tr>
    <td><code>Definition &ltdefinition></code></td>
    <td>Submits a definition for a player. Punctuation and capitalization is preserved in the player's response.</td>
  </tr>
  <tr>
    <td><code>&ltnumber></code></td>
    <td>Logs the player's vote for the definition with the number submitted.</td>
  </tr>
</table>

## Deploy your own BalderText game

### Requirements
* [Node](https://nodejs.org/en/download/) version 10 or greater, and NPM (included in the Node installation bundle).
* A free or paid [Twilio account](https://www.twilio.com/try-twilio). You'll need the account SID and the auth token for your `.env` file.
* [A Wordnik API key](https://developer.wordnik.com/) to fetch word definitions. You'll need the API key in your `.env` file.

### Credentials and your .env file
Rename the included `.env.example` file to `.env`.
Take the credentials you gathered above and replace the `XXXX`s in the example `.env` file with your real credentials.

### Deploy
1. Clone this repository `git clone git@github.com:eshenfield/baldertext.git` to your machine.
2. Run `npm install` inside the BalderText directory to set up the Twilio Serverless toolkit.
3. Run `npm deploy` to deploy your Baldertext instance using the Twilio Serverless toolkit. It should take a minute or two, and when the deploy is complete, it will list out the **Deployment Details** in your terminal. Copy the url listed under "Functions" (it should end in '/game') and save it for the next step.
4. From the Twilio console, configure your phone number to respond to incoming messages with a `Webhook` that makes an `HTTP Post` request to the URL you saved in step 3.
5. Try texting 'join game' to your number to make sure everything is working!


## Run BalderText locally on your own system
You might want to add additional functionality or play around with the existing code. To do so, you can run BalderText locally and tinker with the game!

### Requirements
* [Node](https://nodejs.org/en/download/) version 10 or greater, and NPM (included in the Node installation bundle).
* [ngrok](https://ngrok.com/) -- this utility connects the development version of BalderText running on your system to a public URL that Twilio can connect to. You can download a copy for Windows, MacOs, or Linux [here](https://ngrok.com/download).
* A free or paid [Twilio account](https://www.twilio.com/try-twilio). You'll need the account SID and the auth token for your `.env` file.
* [A Wordnik API key](https://developer.wordnik.com/) to fetch word definitions. You'll need the API key in your `.env` file.

### Credentials and your .env file
Rename the included `.env.example` file to `.env`.
Take the credentials you gathered above and replace the `XXXX`s in the example `.env` file with your real credentials.

### Run
1. Clone this repository `git clone git@github.com:eshenfield/baldertext.git` to your machine.
2. Run `npm install` to install the required project dependencies.
3. Run `npm run start` to start your server.
4. Start up `ngrok` to expose http://localhost:3000 at a different `.ngrok.io` url.
5. From the Twilio console, configure your phone number to respond to incoming messages with a `Webhook` that makes an `HTTP Post` request to `your-ngrok-domain.ngrok.io/game`.
6. Try texting 'join game' to your number to make sure everything is working!

