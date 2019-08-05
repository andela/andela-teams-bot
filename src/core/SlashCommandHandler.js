import Slack from '../integrations/Slack';

const slack = new Slack();

export default class SlashCommandHandler {
  async teams(req, res, next) {
    try {
      var actions = [];
      if (req.user && req.user.is_facilitator) {
        actions.push({
          name: 'landing_page_menu',
          text: 'Create Team...',
          style: 'primary',
          type: 'button',
          value: 'create_team'
        });
        actions.push({
          name: 'landing_page_menu',
          text: 'Analytics',
          type: 'button',
          value: 'analytics'
        });
      }
      actions.push({
        name: 'landing_page_menu',
        text: 'Help',
        type: 'button',
        url: 'https://github.com/andela/andela-teams-bot/wiki'
      });
      const attachments = [{
        callback_id: 'landing_page_menu',
        color: 'warning',
        fallback: 'Could not perform operation.',
        actions: actions
      }];

      await slack.chat.postResponse(null, req.body.response_url, attachments);
    } catch (error) {
      next(error);
    }
  }
}
