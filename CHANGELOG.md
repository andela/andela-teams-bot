# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Visual representation of analytics on feedback.

## [2.0.0] - 2019-04-09
### Deprecated
- The ability to give feedback has been moved to another app.
- The ability to see analytics on feedback has been moved to another app.

## [1.0.1] - 2019-04-07
### Changed
- `:add_me:` reaction no longer supported.

## [1.0.0] - 2019-02-18
### Added
- Add feedback type to the __Record Feedback__ dialog.
- To join or leave a repo/project, on the URL click the action items `Join repo/project` or `Leave repo/project`.
- Channels and multi-DMs can now be chosen as the target user (recipient) of feedback on the `Record Feedback` dialog. This records a feedback instance for all users (except the giver of the feedback of course) in the channel or multi-DM.
- `Andela Teams` bot sends a direct message to users whenever a piece of feedback meant for them is recorded.

### Changed
- The __Andela Teams__ bot now sends a direct message to a user whenever it has insufficient permission to send an ephemeral message to that user. Such a message reports the success or failure of an action the user performed using the app.

### Deprecated
- The use of the `:add_me:` reaction to join or leave repos/projects _may_ be unsupported in the future.

## [0.2.0] - 2019-02-11
### Added
- Click the `Mark as feedback...` menu action to record feedback.
- The app now has a database of `D0A` and `D0B` skills (matched to their corresponding attributes).
- Feedback instances and URLs of repos/projects that have been in the database for 4 months or more will be auto-deleted.

### Changed
- `:add_me:` reaction now works on only URLs of repos/projects created using this app. This is to avoid abuse of this feature.

## [0.1.0] - 2019-01-28
### Added
- Run the `/team` or `/teams` command to get started.
- Click the `Create Team` button to see the __Create Team__ dialog.
- Submitting the __Create Team__ dialog presents you buttons containing suggested names of Github repos and Pivotal Tracker projects. Clicking any of the buttons creates the repo/project with the name appearing on the button.
- To create a repo/project with custom settings, click the `Custom...` buttons.
- To join (or leave) a repo/project, react (or _unreact_) to the URL of the repo/project with the `:add_me:` emoji.
