export default class HelperFunctions {
  getCreateGithubRepoDialogJson() {
    return {
      callback_id: 'create_github_repo_dialog',
      title: 'Create Github Repo',
      state: 'create_github_repo_dialog',
      elements: [
        {
          type: 'text',
          label: 'Repo Name',
          name: 'repo_name'
        },
        {
          type: 'text',
          label: 'Description',
          name: 'repo_desc',
          optional: true
        },
        {
          type: 'select',
          label: 'Repo Visibility',
          name: 'repo_visibility',
          value: 'public',
          options: [{
            label: 'Public',
            value: 'public'
          }, {
            label: 'Private',
            value: 'private'
          }]
        }
      ]
    };
  }

  getCreatePtProjectDialogJson() {
    return {
      callback_id: 'create_pt_project_dialog',
      title: 'Create PT Project',
      state: 'create_pt_project_dialog',
      elements: [
        {
          type: 'text',
          label: 'Project Name',
          name: 'project_name'
        },
        {
          type: 'text',
          label: 'Description',
          name: 'project_desc',
          optional: true
        },
        {
          type: 'select',
          label: 'Project Visibility',
          name: 'project_visibility',
          value: 'public',
          options: [{
            label: 'Public',
            value: 'public'
          }, {
            label: 'Private',
            value: 'private'
          }]
        }
      ]
    };
  }

  getCreateTeamDialogJson() {
    return {
      callback_id: 'create_team_dialog',
      title: 'Create Team',
      state: 'create_team_dialog',
      elements: [
        {
          type: 'text',
          label: 'Team Name',
          name: 'team_name'
        },
        {
          type: 'text',
          label: 'Project',
          name: 'team_project'
        }
      ]
    };
  }

  getPtAnalyticsDialogJson() {
    return {
      callback_id: 'pt_analytics_dialog',
      title: 'PT Analytics',
      state: 'pt_analytics_dialog',
      elements: [
        {
          type: 'text',
          label: 'PT Project URL',
          name: 'project_url',
          placeholder: 'https://www.pivotaltracker.com/n/projects/1234567',
          subtype: 'url'
        },
        {
          type: 'select',
          label: 'From',
          name: 'analytics_start_date',
          // hint: 'This should be in the past of the front date',
          data_source: 'external'
        },
        {
          type: 'select',
          label: 'To',
          name: 'analytics_end_date',
          // hint: 'This should be in the future of the back date',
          data_source: 'external'
        },
        {
          type: 'select',
          label: 'Analytics Type',
          name: 'analytics_type',
          value: 'users_vs_skills',
          options: [{
            label: 'Users and the skills they have touched',
            value: 'users_vs_skills'
          }, {
            label: 'Skills and the users that touched them',
            value: 'skills_vs_users'
          },{
            label: 'Users and the stories they have touched',
            value: 'users_vs_stories'
          }, {
            label: 'Stories and the users that touched them',
            value: 'stories_vs_users'
          }, {
            label: 'Kanban view',
            value: 'kanban_view'
          }, {
            label: 'Users\' collaborations',
            value: 'users_collaborations'
          }]
        }
      ]
    };
  }

  getUrlFriendlyName(word) {
    return word.replace(/\s/g, '-').toLowerCase();
  }

  getInitials(word) {
    // b=positon w=matches any word g=repeat the word through all string
    let removeCase = word.replace(/[^a-zA-Z0-9 ]/g, "");
    let matches = removeCase.match(/\b(\w)/g);
    return matches.join('').toLowerCase();
  }

  getTitleCase(sentence) {
    let splitStr = sentence.toLowerCase().split(' ');
    for (let i = 0; i < splitStr.length; i++) {
        splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);     
    }
    // Directly return the joined string
    return splitStr.join(' '); 
 }

  githubConventions(teamName, projectName = 'ah') {
    return [
      `${teamName}-${projectName}`, `${teamName}-${projectName}-backend`, `${projectName}-${teamName}-backend`,
      `${projectName}-${teamName}`, `${teamName}-${projectName}-frontend`, `${projectName}-${teamName}-frontend`,
    ];
  }

  ptConventions(teamName, projectName = 'ah') {
    return [
      `${teamName}`,
      `${teamName}-${projectName}`,
      `${projectName}-${teamName}`
    ];
  }
}
