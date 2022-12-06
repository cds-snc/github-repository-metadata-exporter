"use strict";

const core = require("@actions/core");
const github = require("@actions/github");
const { createAppAuth } = require("@octokit/auth-app");

const { postData } = require("./lib/forwarder.js");
const {
  queryBranchProtection,
  queryCodeScanningAlerts,
  queryCommitCount,
  queryDependabotAlerts,
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
  await postData(
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
  await postData(
    logAnalyticsWorkspaceId,
    logAnalyticsWorkspaceKey,
    branchProtectionData,
    prefix + "BranchProtection"
  );
  console.log("✅ BranchProtection data sent to Azure Log Analytics");

  // Get branch protection data for main branch
  const commitCountData = await queryCommitCount(octokit, owner, repo);
  await postData(
    logAnalyticsWorkspaceId,
    logAnalyticsWorkspaceKey,
    commitCountData,
    prefix + "CommitCount"
  );
  console.log("✅ CommitCount data sent to Azure Log Analytics");

  // Get required files data for current branch
  const requiredFilesData = await queryRequiredFiles(owner, repo);
  await postData(
    logAnalyticsWorkspaceId,
    logAnalyticsWorkspaceKey,
    requiredFilesData,
    prefix + "RequiredFiles"
  );
  console.log("✅ RequiredFiles data sent to Azure Log Analytics");

  // Get dependabot alerts data for current branch
  const dependabotAlertsData = await queryDependabotAlerts(
    octokit,
    owner,
    repo
  );
  await postData(
    logAnalyticsWorkspaceId,
    logAnalyticsWorkspaceKey,
    dependabotAlertsData,
    prefix + "DependabotAlerts"
  );
  console.log("✅ DependabotAlerts data sent to Azure Log Analytics");

  // Get code scanning alerts data for current branch
  const codeScanningAlertsData = await queryCodeScanningAlerts(
    octokit,
    owner,
    repo
  );

  // Breaks code scanning results into chunks of 20
  const chunkSize = 20;
  const codeScanningAlertsDataChunks =
    codeScanningAlertsData.code_scanning_alerts;

  for (let i = 0; i < codeScanningAlertsDataChunks.length; i += chunkSize) {
    const chunk = codeScanningAlertsDataChunks.slice(i, i + chunkSize);
    let data = {
      code_scanning_alerts: chunk,
    };

    await postData(
      logAnalyticsWorkspaceId,
      logAnalyticsWorkspaceKey,
      { ...codeScanningAlertsData, ...data },
      prefix + "CodeScanningAlerts"
    );
    console.log(
      `⏱️ ${chunk.length} code scanning alerts sent to Azure Log Analytics.`
    );
  }
  console.log("✅ CodeScanningAlerts data sent to Azure Log Analytics");
};

module.exports = {
  action: action,
};
