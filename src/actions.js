"use strict";

const core = require("@actions/core");
const github = require("@actions/github");

const { postData } = require("./lib/forwarder.js");
const { queryRepository } = require("./lib/query.js");

const action = async () => {
  const logWorkspaceId = core.getInput("log-workspace-id");
  const logWorkspaceKey = core.getInput("log-workspace-key");
  const token = core.getInput("github-token");
  const octokit = token !== "false" ? github.getOctokit(token) : undefined;

  const owner = github.context.repo.owner;
  const repo = github.context.repo.repo;

  // Get repository data
  const repository = await queryRepository(octokit, owner, repo);
  console.log(repository);
  //postData(logWorkspaceId, logWorkspaceKey, JSON.stringify(repository), "GitHubRepository");
  console.log("Repository data sent to Azure Log Analytics");
};

module.exports = {
  action: action,
};
