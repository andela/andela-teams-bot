import dotenv from 'dotenv';
import redis from 'redis';
import request from 'request-promise-native';
import SlackBot from 'slackbots';
import { promisify } from 'util';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const client = redis.createClient(process.env.REDIS_URL);
const getAsync = promisify(client.get).bind(client);

const bot = new SlackBot({
  token: process.env.SLACK_BOT_TOKEN, 
  name: 'StackUp Teams'
});

class Chat {
  constructor() {
    this.postDM = this.postDM.bind(this);
    this.postEphemeral = this.postEphemeral.bind(this);
    this.postEphemeralOrDM = this.postEphemeralOrDM.bind(this);
    this.postResponse = this.postResponse.bind(this);
  }
  async postDM(message, userId, attachments) {
    const user = await new Resolver().getUserInfoObject(userId);
    if (user && user.name) {
      await bot.postMessageToUser(
        user.name,
        message,
        {
          attachments
        }
      );
    }
  }
  async postEphemeral(message, channelId, userId, attachments) {
    let url = 'https://slack.com/api/chat.postEphemeral';
    let response = await request({
      url,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_USER_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: {
        text: message,
        channel: channelId,
        user: userId,
        attachments
      },
      json: true,
      resolveWithFullResponse: true
    });
    return response.body;
  }
  async postEphemeralOrDM(message, channelId, userId, attachments) {
    let response = await this.postEphemeral(message, channelId, userId, attachments);
    if (!response.ok) {
      await this.postDM(message, userId, attachments);
    }
  }
  async postResponse(message, responseUrl, attachments) {
    await request({
      url: responseUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        text: message,
        attachments
      },
      json: true,
      resolveWithFullResponse: true
    });
  }
}

class Dialog {
  async open(triggerId, dialogJson) {
    let url = 'https://slack.com/api/dialog.open';
    let response = await request({
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      formData: {
        token: process.env.SLACK_USER_TOKEN,
        trigger_id: triggerId,
        dialog: JSON.stringify(dialogJson)
      },
      resolveWithFullResponse: true
    });
    return JSON.parse(response.body);
  }
}

class Resolver {
  async getChannelMembers(channelId) {
    let members = [];
    let url = 'https://slack.com/api/conversations.members';
    url += '?channel=' + channelId;
    url += '&token=' + process.env.SLACK_USER_TOKEN;
    let response = await request({
      url: url,
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      resolveWithFullResponse: true
    });
    let data = JSON.parse(response.body);
    if (data.ok && data.members) {
      members = data.members;
    }

    return members;
  }
  async getMessageFromChannel(ts, channelId) {
    let url = 'https://slack.com/api/conversations.history';
    url += '?channel=' + channelId;
    url += '&latest=' + ts;
    url += '&token=' + process.env.SLACK_USER_TOKEN;
    url += '&inclusive=true&limit=1';
    let response = await request({
      url: url,
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      resolveWithFullResponse: true
    });
    let data = JSON.parse(response.body);
    if (data.ok && data.messages.length > 0) {
      return data.messages[0].text;
    }
    return data; // TODO: what to return otherwise
  }
  async getUserInfoObject(userId) {
    var user = await getAsync(`slack/${userId}`);

    if (user) {
      return JSON.parse(user);
    } else {
      // make a request to resolve the user
      let url = 'https://slack.com/api/users.info';
      url += '?user=' + userId;
      url += '&token=' + process.env.SLACK_USER_TOKEN;
      let response = await request({
        url: url,
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        resolveWithFullResponse: true
      });
      let data = JSON.parse(response.body);
      user = data.user || user;

      // keys should expire after 24 hours
      client.set(`slack/${userId}`, JSON.stringify(user), 'EX', 60 * 60 * 24);

      return user;
    }
  }
  async getUserProfileObject(userId) {
    // unfortunately we can't redis-cache the result here
    // because we need people to be able to update their Github and email on Slack
    // and have it reflect immediately

    var user;
    
    // make a request to resolve the user
    let url = 'https://slack.com/api/users.profile.get'; // 'https://slack.com/api/users.info';
    url += '?user=' + userId;
    url += '&token=' + process.env.SLACK_USER_TOKEN;
    let response = await request({
      url: url,
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      resolveWithFullResponse: true
    });
    let data = JSON.parse(response.body);
    user = data.profile || user;

    // see if user has github repo in their profile info
    if (user.fields && user.fields['Xf5LPLTLQ4']) {
      user.github = user.fields['Xf5LPLTLQ4'].value;
      if (user.github.includes('/')) {
        if (user.github.endsWith('/')) {
          user.github = user.github.substring(0, user.github.length - 1);
        }
        user.github_user_name = user.github.substring(user.github.lastIndexOf('/') + 1);
      } else {
        user.github_user_name = user.github;
      }
    }

    // see if user if part of group @simulations-facilitators
    let groups = [];
    url = 'https://slack.com/api/usergroups.list';
    url += '?include_disabled=false';
    url += '&include_users=true';
    url += '&token=' + process.env.SLACK_USER_TOKEN;
    response = await request({
      url: url,
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      resolveWithFullResponse: true
    });
    data = JSON.parse(response.body);
    if (data.ok && data.usergroups) {
      groups = data.usergroups;
    }
    let grp = groups.find((g) => g.handle == 'simulations-facilitators');
    if (grp) {
      user.is_sims_facilitator = grp.users.includes(userId);
    }
    grp = groups.find((g) => g.handle == 'bc-leads');
    if (grp) {
      user.is_bootcamp_facilitator = grp.users.includes(userId);
    }
    user.is_facilitator = user.is_sims_facilitator || user.is_bootcamp_facilitator;

    return user;
  }
}

export default class Slack {
  /**
   * @constructor
   */
  constructor() {
    this.chat = new Chat();
    this.dialog = new Dialog();
    this.resolver = new Resolver();
  }
}
