"use strict";

const core = require("@actions/core");
const github = require("@actions/github");

const { postData } = require("./lib/forwarder.js");
const { queryBranchProtection, queryRepository } = require("./lib/query.js");

const prefix = "GitHubMetadata_";

const action = async () => {
  const logAnalyticsWorkspaceId = core.getInput("log-analytics-workspace-id");
  const logAnalyticsWorkspaceKey = core.getInput("log-analytics-workspace-key");
  const token = core.getInput("github-token");
  const octokit = github.getOctokit(token);

  const owner = github.context.repo.owner;
  const repo = github.context.repo.repo;

  // Get repository data
  const repository = await queryRepository(octokit, owner, repo);
  postData(
    logAnalyticsWorkspaceId,
    logAnalyticsWorkspaceKey,
    repository,
    prefix + "Repository"
  );
  console.log("✅ Repository data sent to Azure Log Analytics");

  // Get branch protection data for main branch
  const branchProtectionData = await queryBranchProtection(
    octokit,
    owner,
    repo,
    "main"
  );
  postData(
    logAnalyticsWorkspaceId,
    logAnalyticsWorkspaceKey,
    branchProtectionData,
    prefix + "BranchProtection"
  );
  console.log("✅ BranchProtection data sent to Azure Log Analytics");
};

module.exports = {
  action: action,
};
