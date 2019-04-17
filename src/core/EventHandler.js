import HelperFunctions from './HelperFunctions';
import Slack from '../integrations/Slack';
import Utility from './Utility';

const helpers = new HelperFunctions();
const slack = new Slack();
const utils = new Utility();

export default class EventHandler {
  async addMeReaction(req, res, next) {
    try {
      let event = req.body.event;
      if (event.reaction === 'add_me') {
        if (event.item.type === 'message') {
          var messageText = await slack.resolver.getMessageFromChannel(event.item.ts, event.item.channel);
          let urls = helpers.getUrls(messageText);
          if (urls) {
            urls.forEach(url => {
              utils.addOrRemoveUser(
                url.substring(1, url.length - 1).toLowerCase(), // trim url of < and >
                req.user,
                event.user,
                event.item.channel,
                event.type === 'reaction_added');
            });
          } else {
            slack.chat.postEphemeralOrDM(
              `No URL was detected in the message.`,
              payload.channel.id,
              payload.user.id);
          }
        }
      }
  
      next();
    } catch(error) {
      next(error);
    }
  }
  async challenge(req, res, next) {
    res.header('Content-Type', 'application/x-www-form-urlencoded');
    // if Slack is "challenging" our URL in order to verify it
    if (req.body.challenge) {
      return res.status(200).json({ challenge: req.body.challenge });
    }
    res.status(200).send();
    next();
  }
}
