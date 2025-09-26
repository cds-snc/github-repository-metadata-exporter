"use strict";

const core = require("@actions/core");
const github = require("@actions/github");
const { createAppAuth } = require("@octokit/auth-app");

const { postData, uploadToS3 } = require("./lib/forwarder.js");
const {
  queryActionDependencies,
  queryAllPRs,
  queryBranchProtection,
  queryCodeScanningAlerts,
  queryCodespaces,
  queryCommitCount,
  queryDependabotAlerts,
  queryRepository,
  queryRequiredFiles,
  queryRenovatePRs,
  queryUsers,
  queryFailedDeployments,
} = require("./lib/query.js");

const prefix = "GitHubMetadata_";
const chunkSize = 10;

const action = async () => {
  const logAnalyticsWorkspaceId = core.getInput("log-analytics-workspace-id");
  const logAnalyticsWorkspaceKey = core.getInput("log-analytics-workspace-key");

  const githubAppId = core.getInput("github-app-id");
  const githubAppInstallationId = core.getInput("github-app-installation-id");
  const githubAppPrivateKey = core.getInput("github-app-private-key");

  const orgDataRepo = core.getInput("org-data-repo");

  // S3 config from action parameters (set via secrets)
  const s3Bucket = core.getInput("s3-bucket");
  const awsRegion = core.getInput("aws-region");

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

  // Helper to send to S3
  async function sendToS3(data, type) {
    const key = `${type}/${owner}-${repo}-${new Date().toISOString()}.json`;
    await uploadToS3(s3Bucket, key, data, awsRegion);
    console.log(`✅ Data sent to S3: ${key}`);
  }

  // Get repository data
  const repository = await queryRepository(octokit, owner, repo);
  await postData(
    logAnalyticsWorkspaceId,
    logAnalyticsWorkspaceKey,
    repository,
    prefix + "Repository"
  );
  console.log("✅ Repository data sent to Azure Log Analytics");

  // Get all PRs modified today and write to S3 only
  const allPRs = await queryAllPRs(octokit, owner, repo);
  await sendToS3(allPRs, "AllPRs");
  console.log("✅ AllPRs data sent to S3");

  // Get failed deployments from yesterday and send to S3
  const failedDeploymentsData = await queryFailedDeployments(
    octokit,
    owner,
    repo
  );
  await sendToS3(failedDeploymentsData, "FailedDeployments");
  console.log("✅ FailedDeployments data sent to S3");

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

  // Get commit count data
  const commitCountData = await queryCommitCount(octokit, owner, repo);
  await postData(
    logAnalyticsWorkspaceId,
    logAnalyticsWorkspaceKey,
    commitCountData,
    prefix + "CommitCount"
  );
  await sendToS3(commitCountData, "CommitCount");
  console.log("✅ CommitCount data sent to Azure Log Analytics and S3");

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
  await sendToS3(dependabotAlertsData, "DependabotAlerts");
  console.log("✅ DependabotAlerts data sent to Azure Log Analytics and S3");

  // Get code scanning alerts data for current branch
  const codeScanningAlertsData = await queryCodeScanningAlerts(
    octokit,
    owner,
    repo
  );

  // Breaks code scanning results into chunks of 10
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

  // Get Renovate PRs data for current repo
  const renovatePRsData = await queryRenovatePRs(octokit, owner, repo);

  // Breaks code scanning results into chunks of 10
  const renovatePRsDataChunks = renovatePRsData.renovate_prs;

  for (let i = 0; i < renovatePRsDataChunks.length; i += chunkSize) {
    const chunk = renovatePRsDataChunks.slice(i, i + chunkSize);
    let data = {
      renovate_prs: chunk,
    };

    await postData(
      logAnalyticsWorkspaceId,
      logAnalyticsWorkspaceKey,
      { ...renovatePRsData, ...data },
      prefix + "RenovatePRs"
    );
    console.log(`⏱️ ${chunk.length} renovate PRs sent to Azure Log Analytics.`);
  }
  console.log("✅ RenovatePRs data sent to Azure Log Analytics");

  // Get required files data for current branch
  const actionDependenciesData = await queryActionDependencies(owner, repo);
  await postData(
    logAnalyticsWorkspaceId,
    logAnalyticsWorkspaceKey,
    actionDependenciesData,
    prefix + "ActionDependencies"
  );
  console.log("✅ ActionDependencies data sent to Azure Log Analytics");

  // Get central repository data if current repo is org data repo
  if (orgDataRepo == `${owner}/${repo}`) {
    console.log("🐿️ Getting org data");

    // Get users data from org
    console.log("👤 Getting user data");
    const usersData = await queryUsers(octokit, owner);

    const usersDataChunks = usersData.users;

    for (let i = 0; i < usersDataChunks.length; i += chunkSize) {
      const chunk = usersDataChunks.slice(i, i + chunkSize);
      let data = {
        users: chunk,
      };

      await postData(
        logAnalyticsWorkspaceId,
        logAnalyticsWorkspaceKey,
        { ...usersData, ...data },
        prefix + "Users"
      );
      console.log(`⏱️ ${chunk.length} users sent to Azure Log Analytics.`);
    }
    console.log("✅ Users data sent to Azure Log Analytics");

    // Get codespaces data from org
    console.log("🖥️ Getting codespaces data");
    const codespacesData = await queryCodespaces(octokit, owner);

    const codespacesDataChunks = codespacesData.codespaces;

    for (let i = 0; i < codespacesDataChunks.length; i += chunkSize) {
      const chunk = codespacesDataChunks.slice(i, i + chunkSize);
      let data = {
        codespaces: chunk,
      };

      await postData(
        logAnalyticsWorkspaceId,
        logAnalyticsWorkspaceKey,
        { ...codespacesData, ...data },
        prefix + "Codespaces"
      );
      console.log(`⏱️ ${chunk.length} codespaces sent to Azure Log Analytics.`);
    }
    console.log("✅ Codespaces data sent to Azure Log Analytics");
  }
};

module.exports = {
  action: action,
};
