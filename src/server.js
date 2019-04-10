import 'babel-polyfill' // eslint-disable-line
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';

import DataHandler from './core/DataHandler';
import Eventhandler from './core/EventHandler';
import InteractionHandler from './core/InteractionHandler';
import PivotalTrackerAnalytics from './analytics/PivotalTrackerAnalytics';
import SlashCommandHandler from './core/SlashCommandHandler';
import Utility from './core/Utility';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = new express();
app.use(cors());
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

const data = new DataHandler();
const event = new Eventhandler();
const interaction = new InteractionHandler();
const ptAnalytics = new PivotalTrackerAnalytics();
const slash = new SlashCommandHandler();
const utils = new Utility();

app.get('/', async (req, res) => {
  res.status(200).send("Hello World!<br /><br />Welcome to Andela Teams for Slack.");
});

app.get('/api/analytics/pt/:token',
  ptAnalytics.get);

app.post('/data/external',
  utils.getUserObjectFromReqBodyPayloadUserId,
  data.dialogSuggestions);

app.post('/events', 
  event.challenge,
  utils.getUserObjectFromReqBodyEventUser,
  utils.rejectUsersWithNoEmailOrGithub,
  event.addMeReaction,
  utils.handleErrors);

app.post('/interactions',
  utils.postEmptyMessage,
  utils.getUserObjectFromReqBodyPayloadUserId,
  utils.rejectUsersWithNoEmailOrGithub,
  interaction.dialogSubmission,
  interaction.interactiveMessage,
  interaction.messageAction,
  utils.handleErrors);

app.post('/slash/teams',
  utils.postWelcomeMessage,
  utils.getUserObjectFromReqBodyUserId,
  utils.rejectUsersWithNoEmailOrGithub,
  slash.teams,
  utils.handleErrors);

let server = app.listen(process.env.PORT || 5000, () => {
  let port = server.address().port;
  console.log(`Server started on port ${port}`)
})
