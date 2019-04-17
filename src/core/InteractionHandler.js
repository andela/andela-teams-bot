import jwt from 'jsonwebtoken';

import Github from '../integrations/Github';
import HelperFunctions from './HelperFunctions';
import models from '../models';
import PivotalTracker from '../integrations/PivotalTracker';
import Slack from '../integrations/Slack';
import Utility from './Utility';

const github = new Github();
const helpers = new HelperFunctions();
const pivotal = new PivotalTracker();
const slack = new Slack();
const utils = new Utility();

export default class InteractionHandler {
  async dialogSubmission(req, res, next) {
    try {
      let payload = req.payload;
      if (payload.type === 'dialog_submission') {
        if (payload.callback_id === 'create_github_repo_dialog') {
          await _handleCreateGithubRepoDialog(req);
        } else if (payload.callback_id === 'create_pt_project_dialog') {
          await _handleCreatePtProjectDialog(req);
        } else if (payload.callback_id === 'create_team_dialog') {
          await _postCreateGithubReposPage(req);
          await _postCreatePtBoardPage(req);
        } else if (payload.callback_id === 'pt_analytics_dialog') {
          await _handlePtAnalyticsDialog(req);
        }
        return;
      }
      next();
    } catch(error) {
      next(error);
    }
  }
  async interactiveMessage(req, res, next) {
    try {
      let payload = req.payload;
      if (payload.type === 'interactive_message') {
        const value = payload.actions[0].value;
        if (value === 'analytics') {
          await _postAnalyticsPage(req);
        } else if (value === 'create_team') {
          await slack.dialog.open(payload.trigger_id, helpers.getCreateTeamDialogJson());
        } else if (value.startsWith('create_github_repo:')) {
          let repoName = value.substring(19);
          if (repoName === '?') {
            await slack.dialog.open(payload.trigger_id, helpers.getCreateGithubRepoDialogJson());
          } else {
            req.repoName = repoName;
            await _createAndPostGithubRepoLink(req);
          }
        } else if (value.startsWith('create_pt_project:')) {
          let projectName = value.substring(18);
          if (projectName === '?') {
            await slack.dialog.open(payload.trigger_id, helpers.getCreatePtProjectDialogJson());
          } else {
            req.projectName = projectName;
            await _createAndPostPtProjectLink(req);
          }
        } else if (value === 'pt_analytics') {
          await slack.dialog.open(payload.trigger_id, helpers.getPtAnalyticsDialogJson());
        } 
        return;
      }
      next();
    } catch(error) {
      next(error);
    }
  }
  async messageAction(req, res, next) {
    try {
      let payload = req.payload;
      if (payload.type === 'message_action') {
        if (payload.callback_id === 'join_team' || payload.callback_id === 'leave_team') {
          var messageText = payload.message.text;
          let urls = helpers.getUrls(messageText);
          if (urls) {
            urls.forEach(url => {
              utils.addOrRemoveUser(
                url.substring(1, url.length - 1).toLowerCase(), // trim url of < and >
                req.user,
                payload.user.id,
                payload.channel.id,
                payload.callback_id === 'join_team');
            });
          } else {
            slack.chat.postEphemeralOrDM(
              `No URL was detected in the message.`,
              payload.channel.id,
              payload.user.id);
          }
        }
        return;
      }
      next();
    } catch(error) {
      next(error);
    }
  }
}

async function _createAndPostGithubRepoLink(req) {
  let result = await github.repo.create(req.repoName, {
    description: req.repoDescription || '',
    organization: process.env.GITHUB_ORGANIZATION,
    private: req.repoIsPrivate || false,
    type: 'org',
    user: {
      githubUsername: req.user.github_user_name
    }
  });

  let text = result.url ? 'Github repo created' : 'Could not create Github repo';
  let linkOrError = result.url ? result.url : result.error || result.message;
  // let linkOrError = result.url
  //   ? (result.invitedUser.ok
  //       ? result.url
  //       : result.url + '\n\nAlthough the repo was created you were not added. This could be because you\'ve already been added to the repo before now.')
  //   : result.error || result.message;

  // to use await slack.chat.postEphemeral
  // replace arg req.payload.response_url
  // with req.payload.channel.id, req.payload.user.id
  await slack.chat.postResponse(
    text,
    req.payload.response_url,
    [{
      color: result.url ? 'good' : 'danger',
      text: linkOrError,
    }]);

  if (result.url) {
    await models.Resource.create({
      url: result.url.toLowerCase(),
      userId: req.payload.user.id
    });
  }
}

async function _createAndPostPtProjectLink(req) {
  let result = await pivotal.project.create(req.projectName, {
    accountId: process.env.PIVOTAL_TRACKER_ACCOUNT_ID,
    description: req.projectDescription || '',
    private: req.projectIsPrivate || false,
    user: {
      email: req.user.email
    }
  });

  let text = result.url ? 'Pivotal Tracker project created' : 'Could not create Pivotal Tracker project';
  // let linkOrError = result.ok ? result.url : result.error;
  let linkOrError = result.url
    ? (result.invitedUser.ok
        ? result.url
        : result.url + '\n\nAlthough the project was created you were not added. This could be because you\'ve already been added to the project before now.')
    : result.error;

  await slack.chat.postResponse(
    text,
    req.payload.response_url,
    [{
      color: result.url ? 'good' : 'danger',
      text: linkOrError,
    }]);

    if (result.url) {
      await models.Resource.create({
        url: result.url.toLowerCase(),
        userId: req.payload.user.id
      });
    }
}

async function _handleCreateGithubRepoDialog(req) {
  let submission = req.payload.submission;
  var repoName = submission.repo_name;
  repoName = helpers.getUrlFriendlyName(repoName);

  req.repoName = repoName;
  req.repoDescription = submission.repo_desc || '';
  req.repoIsPrivate = submission.repo_visibility === 'private';
  await _createAndPostGithubRepoLink(req);
}

async function _handleCreatePtProjectDialog(req) {
  let submission = req.payload.submission;
  var projectName = submission.project_name;
  // projectName = helpers.getUrlFriendlyName(projectName);

  req.projectName = projectName;
  req.projectDescription = submission.project_desc || '';
  req.projectIsPrivate = submission.project_visibility === 'private';
  await _createAndPostPtProjectLink(req);
}

async function _handlePtAnalyticsDialog(req) {
  let returnUrl = `https://${req.get('host')}/ui/analytics/pt`;
  let submission = req.payload.submission;
  // check for date correctness
  if (submission.analytics_end_date <= submission.analytics_start_date) {
    await slack.chat.postEphemeralOrDM(
      'The \'To\' date must be ahead of the \'From\' date',
      req.payload.channel.id,
      req.payload.user.id);
    return;
  }
  let projectUrl = submission.project_url;
  // // ensure the link was created by this app by checking the database******************************
  // const existingResource = await models.Resource.findOne({
  //   where: { url: projectUrl }
  // });
  // if (!existingResource) {
  //   // no need to await the promise
  //   slack.chat.postEphemeralOrDM(
  //     `The resource ${projectUrl} was not created using Andela Teams.`,
  //     req.payload.channel.id,
  //     req.payload.user.id);
  //   return;
  // }
  if (projectUrl.endsWith('/')) {
    projectUrl = projectUrl.substring(0, projectUrl.length - 1);
  }
  let projectId = projectUrl.substring(projectUrl.lastIndexOf('/') + 1);
  let query = {
    projectId,
    analyticsType: submission.analytics_type,
    endDate: new Date(submission.analytics_end_date + 'T23:59:59Z'),
    startDate: new Date(submission.analytics_start_date + 'T00:00:00Z')
  };
  if (submission.analytics_type === 'kanban_view') {
    returnUrl += '/kanban';
  } else if (submission.analytics_type === 'skills_vs_users') {
    returnUrl += '/skills-vs-users';
  } else if (submission.analytics_type === 'stories_vs_users') {
    returnUrl += '/stories-vs-users';
  } else if (submission.analytics_type === 'users_collaborations') {
    returnUrl += '/collaborations';
  } else if (submission.analytics_type === 'users_vs_skills') {
    returnUrl += '/users-vs-skills';
  } else if (submission.analytics_type === 'users_vs_stories') {
    returnUrl += '/users-vs-stories';
  }
  const token = jwt.sign(query, process.env.JWT_SECRET);
  returnUrl += `/${token}`;
  await slack.chat.postEphemeralOrDM(
    returnUrl,
    req.payload.channel.id,
    req.payload.user.id);
}

async function _postAnalyticsPage(req) {
  var actions = [];
  actions.push({
    name: 'analytics',
    text: 'Pivotal Tracker...',
    type: 'button',
    value: 'pt_analytics'
  });

  await slack.chat.postResponse(
    'Analytics',
    req.payload.response_url,
    [{
      callback_id: 'analytics',
      color: 'warning',
      fallback: 'Could not perform operation.',
      actions: actions
    }]);
}

async function _postCreateGithubReposPage(req) {
  let submission = req.payload.submission;
  var teamName = submission.team_name;
  teamName = helpers.getUrlFriendlyName(teamName);
  var teamProject = submission.team_project || 'Authors Haven';
  teamProject = helpers.getInitials(teamProject);
  let suggestedNames = helpers.githubConventions(teamName, teamProject);

  var actions = [];
  var i = 0;
  for (i = 0; i <= suggestedNames.length; i++) {
    actions.push({
      name: 'create_github_repo',
      text: suggestedNames[i],
      type: 'button',
      value: `create_github_repo:${suggestedNames[i]}`
    });
  }
  actions.push({
    name: 'create_github_repo',
    text: 'Custom...',
    style: 'primary',
    type: 'button',
    value: 'create_github_repo:?'
  });

  // since slack allows a max of 5 action buttons, I'll split them
  await slack.chat.postResponse(
    'Click buttons to create Github repos',
    req.payload.response_url,
    [{
      callback_id: 'create_github_repo',
      color: 'warning',
      fallback: 'Could not perform operation.',
      // text: '',
      // title: '',
      // title_link: '',
      actions: actions.slice(0, 3)
    }]);
  await slack.chat.postResponse(
    null,
    req.payload.response_url,
    [{
      callback_id: 'create_github_repo',
      color: 'warning',
      fallback: 'Could not perform operation.',
      actions: actions.slice(3)
    }]);
}

async function _postCreatePtBoardPage(req) {
  let submission = req.payload.submission;
  var teamName = submission.team_name;
  teamName = helpers.getUrlFriendlyName(teamName);
  var teamProject = submission.team_project || 'Authors Haven';
  teamProject = helpers.getInitials(teamProject);
  let suggestedNames = helpers.ptConventions(teamName, teamProject);

  var actions = [];
  var i = 0;
  for (i = 0; i <= suggestedNames.length; i++) {
    actions.push({
      name: 'create_pt_project',
      text: suggestedNames[i],
      type: 'button',
      value: `create_pt_project:${suggestedNames[i]}`
    });
  }
  actions.push({
    name: 'create_pt_project',
    text: 'Custom...',
    style: 'primary',
    type: 'button',
    value: 'create_pt_project:?'
  });

  await slack.chat.postResponse(
    'Click buttons to create Pivotal Tracker projects',
    req.payload.response_url,
    [{
      callback_id: 'create_pt_project',
      color: 'warning',
      fallback: 'Could not perform operation.',
      actions: actions
    }]);
}
