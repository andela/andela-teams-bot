import jwt from 'jsonwebtoken';

import HelperFunctions from '../core/HelperFunctions';
import PivotalTracker from '../integrations/PivotalTracker';

const helpers = new HelperFunctions();
const pivotal = new PivotalTracker();

export default class PivotalTrackerAnalytics {
  async get(req, res, next) {
    try {
      let token = req.params.token;
      const query = jwt.verify(token, process.env.JWT_SECRET);
      const options = {
        updated_after: query.startDate + 'T00:00:00Z',
        updated_before: query.endDate + 'T23:59:59Z'
      };
      console.log(options)
      const items = await pivotal.project.fetchStories(query.projectId, options);
      let records = [];
      if (query.analyticsType === 'kanban_view') {
        records = await _getKanbanView(items);
      } else if (query.analyticsType === 'skills_vs_users') {
        records = await _getSkillsVsUsers(items, query.projectId);
      } else if (query.analyticsType === 'stories_vs_users') {
        records = await _getStoriesVsUsers(items, query.projectId);
      } else if (query.analyticsType === 'users_collaborations') {
        records = await _getUsersCollaborations(items, query.projectId);
      } else if (query.analyticsType === 'users_vs_skills') {
        records = await _getUsersVsSkills(items, query.projectId);
      } else if (query.analyticsType === 'users_vs_stories') {
        records = await _getUsersVstories(items, query.projectId);
      }
      return res.status(200).json({ records });
    } catch(error) {
      next(error);
    }
  }
}

function _getKanbanView(items) {
  let stateGroupsMap = new Map();
  for (let i = 0; i < items.length; i++) {
    let item = items[i];
    if (stateGroupsMap.has(item.current_state)) {
      let stories = Array.from(stateGroupsMap.get(item.current_state));
      stories.push(item);
      stateGroupsMap.set(item.current_state, stories);
    } else {
      stateGroupsMap.set(item.current_state, [item]);
    }
  }
  let records = [];
  for (let [state, stories] of stateGroupsMap) {
    records.push({
      title: helpers.getTitleCase(state),
      count: stories.length,
      percent: (Number(stories.length) / items.length) * 100,
      stories
    });
  }
  return records;
}

async function _getUsersCollaborations(items, projectId) {
  let highestNumOfPairStories = 0;
  let records = [];
  let collaborations = [];
  let userIds = [];
  let teamStories = items.filter(i => i.owner_ids.length > 1);

  // caching function
  async function __getUserFromPt(userId) {
    let member = await pivotal.project.getMember(userId, projectId);
    return { name: member.person.name, email: member.person.email };
  };

  // get all user IDs
  teamStories.forEach(s => {
    s.owner_ids.forEach(id => {
      if (!userIds.includes(id)) {
        userIds.push(id);
      }
    });
  });
  // get all collaborations
  for (let i = 0; i < userIds.length; i++) {
    for (let j =  (i + 1); j < userIds.length; j++) {
      let pairedStories =
        teamStories.filter(s => s.owner_ids.includes(userIds[i]) && s.owner_ids.includes(userIds[j]))
        .map(s => ({ id: s.id, name: s.name, url: s.url }));
      highestNumOfPairStories = Math.max(highestNumOfPairStories, pairedStories.length);
      if (pairedStories.length > 0) {
        collaborations.push({
          pairs: [userIds[i], userIds[j]],
          stories: pairedStories
        });
      }
    }
  }
  // create user objects and their collaborations
  for (let i = 0; i < userIds.length; i++) {
    let id = userIds[i];
    let user = await __getUserFromPt(id);
    let allPairedIds =
      collaborations.filter(c => c.pairs.includes(id))
      .map(c => c.pairs[0] !== id ? c.pairs[0] : c.pairs[1]);
    user.collaborations = []
    for(let j = 0; j < allPairedIds.length; j++) {
      let pid = allPairedIds[j];
      let pairedUser = await __getUserFromPt(pid);
      let pairedConns = collaborations.filter(c => c.pairs.includes(id) && c.pairs.includes(pid))
      // let stories = pairedConns.map(c => c.stories);
      let stories = [];
      pairedConns.forEach(c => {
        stories = stories.concat(c.stories);
      });
      user.collaborations.push({
        user: {
            name: pairedUser.name,
            email: pairedUser.email
        },
        //stories,
        numberOfStories: stories.length,
        strength: (stories.length / highestNumOfPairStories) * 100
      })
    }
    records.push(user);
  }
  return records;
}

async function _getSkillsVsUsers(items, projectId) {
  let records = [];
  let hits = [];
  let filteredStories =
    items.filter(
      i => i.owner_ids.length > 0
      && i.labels.length > 0
      && (i.current_state === 'started'
          || i.current_state === 'finished'
          || i.current_state === 'delivered'
          || i.current_state === 'accepted'));

  // caching function
  async function __getUserFromPt(userId) {
    let member = await pivotal.project.getMember(userId, projectId);
    return { name: member.person.name, email: member.person.email };
  };

  // get all labels
  let labels = await pivotal.project.getLabels(projectId);
  labels = labels.filter(l => l.name.toLowerCase().startsWith('skill:'));
  // get all hits
  filteredStories.forEach(s => {
    s.labels.forEach(l => {console.log('got here>>>>>>>>>>>>>>');console.log(l.name);
      if (l.name.toLowerCase().startsWith('skill:')) {
        s.owner_ids.forEach(id => {console.log('also got here>>>>>>>>>>>>>>');
          hits.push({
            userId: id,
            name: l.name,
            state: s.current_state
          });
        });
      }
    });
  });console.log(hits);
  // create skills and their users
  for (let i = 0; i < labels.length; i++) {
    let label = labels[i];
    let hitsMap = new Map();
    label.users = []
    hits.filter(h => h.name === label.name).forEach(h => {
      if (hitsMap.has(h.userId)) {
        let hit = hitsMap.get(h.userId);
        hit.doneHits =
          Number(hit.doneHits) +
          Number(h.state === 'accepted' || h.state === 'delivered' ? 1 : 0);
        hit.ongoingHits =
          Number(hit.ongoingHits) +
          Number(h.state !== 'accepted' && h.state !== 'delivered' ? 1 : 0);
        hitsMap.set(h.userId, hit);
      } else {
        hitsMap.set(h.userId, {
          doneHits: h.state === 'accepted' || h.state === 'delivered' ? 1 : 0,
          ongoingHits: h.state !== 'accepted' && h.state !== 'delivered' ? 1 : 0
        });
      }
    });console.log(hitsMap)
    for (let [userId, hit] of hitsMap) {
      let user = await __getUserFromPt(userId);
      label.users.push({ ...user, ...hit });
    }
    console.log(label);
    // use substring(...) to remove the first 6 characters 'skill:'
    records.push({ name: label.name.substring(6).trim(), users: label.users });
  }
  return records;
}

async function _getStoriesVsUsers(items, projectId) {
  let records = [];
  let filteredStories =
    items.filter(
      i => i.owner_ids.length > 0
      && (i.current_state === 'started'
          || i.current_state === 'finished'
          || i.current_state === 'delivered'
          || i.current_state === 'accepted'));

  // caching function
  async function __getUserFromPt(userId) {
    let member = await pivotal.project.getMember(userId, projectId);
    return { name: member.person.name, email: member.person.email };
  };

  // create stories and their users
  for (let i = 0; i < filteredStories.length; i++) {
    let story = filteredStories[i];
    let users = [];
    for (let j = 0; j < story.owner_ids.length; j++) {
      let user = await __getUserFromPt(story.owner_ids[j]);
      users.push(user);
    }
    records.push({
      id: story.id,
      name: story.name,
      url: story.url,
      users
    });
  }
  return records;
}

async function _getUsersVsSkills(items, projectId) {
  let records = [];
  let hits = [];
  let userIds = [];
  let filteredStories =
    items.filter(
      i => i.owner_ids.length > 0
      && i.labels.length > 0
      && (i.current_state === 'started'
          || i.current_state === 'finished'
          || i.current_state === 'delivered'
          || i.current_state === 'accepted'));

  // caching function
  async function __getUserFromPt(userId) {
    let member = await pivotal.project.getMember(userId, projectId);
    return { name: member.person.name, email: member.person.email };
  };

  // get all user IDs
  filteredStories.forEach(s => {
    s.owner_ids.forEach(id => {
      if (!userIds.includes(id)) {
        userIds.push(id);
      }
    });
  });
  // get all hits
  for (let i = 0; i < userIds.length; i++) {
    filteredStories.filter(s => s.owner_ids.includes(userIds[i]))
      .forEach(s => {
        s.labels.forEach(l => {
          hits.push({
            userId: userIds[i],
            name: l.name,
            state: s.current_state
          });
        });
      });
  }
  // create user objects and their skills
  for (let i = 0; i < userIds.length; i++) {
    let id = userIds[i];
    let hitsMap = new Map();
    let user = await __getUserFromPt(id);
    user.skills = []
    hits.filter(h => h.userId === id).forEach(h => {
      if (hitsMap.has(h.name)) {
        let hit = hitsMap.get(h.name);
        hit.doneHits = Number(hit.doneHits) + Number(h.state === 'accepted' ? 1 : 0);
        hit.ongoingHits = Number(hit.ongoingHits) + Number(h.state !== 'accepted' ? 1 : 0);
        hitsMap.set(h.name, hit);
      } else {
        hitsMap.set(h.name, {
          name: h.name,
          doneHits: h.state === 'accepted' ? 1 : 0,
          ongoingHits: h.state !== 'accepted' ? 1 : 0
        });
      }
    });
    for (let [name, hit] of hitsMap) {
      user.skills.push(hit);
    }
    records.push(user);
  }
  return records;
}

async function _getUsersVstories(items, projectId) {
  let records = [];
  let hits = [];
  let userIds = [];
  let filteredStories =
    items.filter(
      i => i.owner_ids.length > 0
      && i.labels.length > 0
      && (i.current_state === 'started'
          || i.current_state === 'finished'
          || i.current_state === 'delivered'
          || i.current_state === 'accepted'));

  // caching function
  async function __getUserFromPt(userId) {
    let member = await pivotal.project.getMember(userId, projectId);
    return { name: member.person.name, email: member.person.email };
  };

  // get all user IDs
  filteredStories.forEach(s => {
    s.owner_ids.forEach(id => {
      if (!userIds.includes(id)) {
        userIds.push(id);
      }
    });
  });
  // get all hits
  for (let i = 0; i < userIds.length; i++) {
    filteredStories.filter(s => s.owner_ids.includes(userIds[i]))
      .forEach(s => {
        hits.push({
          userId: userIds[i],
          story: s
        });
      });
  }
  // create user objects and their stories
  for (let i = 0; i < userIds.length; i++) {
    let id = userIds[i];
    let user = await __getUserFromPt(id);
    user.stories = []
    hits.filter(h => h.userId === id).forEach(h => {
      user.stories.push({
        id: h.story.id,
        name: h.story.name,
        url: h.story.url
      });
    });
    records.push(user);
  }
  return records;
}
