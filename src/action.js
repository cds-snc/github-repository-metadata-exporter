"use strict";

const core = require("@actions/core");
const github = require("@actions/github");
const { createAppAuth } = require("@octokit/auth-app");

const { postData } = require("./lib/forwarder.js");
const {
  queryBranchProtection,
  queryCommitCount,
  queryRepository,
  queryRequiredFiles,
} = require("./lib/query.js");

const prefix = "GitHubMetadata_";

const action = async () => {
  const logAnalyticsWorkspaceId = core.getInput("log-analytics-workspace-id");
  const logAnalyticsWorkspaceKey = core.getInput("log-analytics-workspace-key");

  const githubAppId = core.getInput("github-app-id");
  const githubAppInstallationId = core.getInput("github-app-installation-id");
  const githubAppPrivateKey = core.getInput("github-app-private-key");

  const auth = createAppAuth({
    appId: githubAppId,
    privateKey: githubAppPrivateKey,
  });

  const installationAuthentication = await auth({
    type: "installation",
    installationId: githubAppInstallationId,
  });

  const octokit = github.getOctokit(installationAuthentication.token);

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

  // Get branch protection data for main branch
  const commitCountData = await queryCommitCount(octokit, owner, repo);
  postData(
    logAnalyticsWorkspaceId,
    logAnalyticsWorkspaceKey,
    commitCountData,
    prefix + "CommitCount"
  );
  console.log("✅ CommitCount data sent to Azure Log Analytics");

  // Get required files data for current branch
  const requiredFilesData = await queryRequiredFiles(owner, repo);
  postData(
    logAnalyticsWorkspaceId,
    logAnalyticsWorkspaceKey,
    requiredFilesData,
    prefix + "RequiredFiles"
  );
  console.log("✅ RequiredF data sent to Azure Log Analytics");
};

module.exports = {
  action: action,
};
