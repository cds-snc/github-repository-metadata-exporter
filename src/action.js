"use strict";

const core = require("@actions/core");
const github = require("@actions/github");
const { createAppAuth } = require("@octokit/auth-app");

const { postData, postDataDCR, getAzureToken, uploadToS3 } = require("./lib/forwarder.js");
const {
  queryActionDependencies,
  queryAllPRs,
  queryBranchProtection,
  queryCodeScanningAlerts,
  queryCodespaces,
  queryCommits,
  queryDependabotAlerts,
  queryRepository,
  queryRequiredFiles,
  queryRenovatePRs,
  queryUsers,
  queryWorkflows,
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
  const s3Bucket =
    core.getInput("s3-bucket") ||
    "cds-data-lake-raw-production/operations/github";
  const awsRegion = core.getInput("aws-region") || "ca-central-1";

  const forwarderMode = core.getInput("forwarder-mode") || "legacy";
  const dceEndpoint = core.getInput("azure-dce-endpoint");
  const dcrImmutableIdsRaw = core.getInput("azure-dcr-immutable-ids");
  const dcrImmutableIds = dcrImmutableIdsRaw ? JSON.parse(dcrImmutableIdsRaw) : {};
  const azureTenantId = core.getInput("azure-tenant-id");
  const azureClientId = core.getInput("azure-client-id");
  const azureOidcAudience =
    core.getInput("azure-oidc-audience") || "api://AzureADTokenExchange";

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
    try {
      const key = `${type}/${owner}-${repo}-${new Date().toISOString()}.json`;
      await uploadToS3(s3Bucket, key, data, awsRegion);
      console.log(`✅ Data sent to S3: ${key}`);
    } catch (error) {
      console.log(`⚠️ Failed to send ${type} data to S3: ${error.message}`);
      console.log("Skipping S3 upload and continuing workflow...");
    }
  }

  // DCR mode: validate that all required log types have a DCR immutable ID
  if (forwarderMode === "dcr") {
    if (!dceEndpoint || !azureTenantId || !azureClientId) {
      throw new Error(
        "DCR mode requires azure-dce-endpoint, azure-tenant-id, and azure-client-id"
      );
    }

    const requiredTypes = [
      "Repository", "BranchProtection", "CommitCount", "RequiredFiles",
      "DependabotAlerts", "CodeScanningAlerts", "RenovatePRs", "ActionDependencies",
    ];
    if (orgDataRepo === `${owner}/${repo}`) {
      requiredTypes.push("Users", "Codespaces");
    }
    const missing = requiredTypes.filter((t) => !dcrImmutableIds[t]);
    if (missing.length > 0) {
      throw new Error(`DCR mode: missing immutable IDs for log types: ${missing.join(", ")}`);
    }
  }

  // Unified Azure forwarding: routes to DCR or legacy endpoint based on forwarder-mode
  let dcrAccessToken = null;
  async function postToAzure(logTypeSuffix, data) {
    if (forwarderMode === "dcr") {
      if (!dcrAccessToken) {
        const federatedToken = await core.getIDToken(azureOidcAudience);
        dcrAccessToken = await getAzureToken(
          azureTenantId,
          azureClientId,
          federatedToken
        );
      }
      await postDataDCR(
        dceEndpoint,
        dcrImmutableIds[logTypeSuffix],
        `Custom-GitHubMetadata_${logTypeSuffix}_v2_Input`,
        data,
        dcrAccessToken
      );
    } else {
      await postData(logAnalyticsWorkspaceId, logAnalyticsWorkspaceKey, data, prefix + logTypeSuffix);
    }
  }

  // Get repository data
  const repository = await queryRepository(octokit, owner, repo);
  await postToAzure("Repository", repository);
  console.log("✅ Repository data sent to Azure Log Analytics");

  // Get all PRs modified today and write to S3 only
  try {
    const allPRs = await queryAllPRs(octokit, owner, repo);
    await sendToS3(allPRs, "AllPRs");
  } catch (error) {
    console.log(`⚠️ Failed to get AllPRs data: ${error.message}`);
    console.log("Skipping AllPRs data collection and continuing workflow...");
  }

  // Get all workflow runs from yesterday and send to S3
  try {
    const workflowsData = await queryWorkflows(octokit, owner, repo);
    await sendToS3(workflowsData, "Workflows");
  } catch (error) {
    console.log(`⚠️ Failed to get Workflows data: ${error.message}`);
    console.log(
      "Skipping Workflows data collection and continuing workflow..."
    );
  }

  // Get branch protection data for main branch
  const branchProtectionData = await queryBranchProtection(
    octokit,
    owner,
    repo,
    "main"
  );
  await postToAzure("BranchProtection", branchProtectionData);
  console.log("✅ BranchProtection data sent to Azure Log Analytics");

  // Get commit data
  // Send commit counts to Log Analytics and full commit data to S3
  const commitData = await queryCommits(octokit, owner, repo);
  const { commits, ...commitCounts } = commitData; // eslint-disable-line no-unused-vars
  const { commit_count, ...commitsFull } = commitData; // eslint-disable-line no-unused-vars
  await postToAzure("CommitCount", commitCounts);
  console.log("✅ CommitCount data sent to Azure Log Analytics");
  await sendToS3(commitsFull, "Commits");

  // Get required files data for current branch
  const requiredFilesData = await queryRequiredFiles(owner, repo);
  await postToAzure("RequiredFiles", requiredFilesData);
  console.log("✅ RequiredFiles data sent to Azure Log Analytics");

  // Get dependabot alerts data for current branch
  const dependabotAlertsData = await queryDependabotAlerts(
    octokit,
    owner,
    repo
  );
  await postToAzure("DependabotAlerts", dependabotAlertsData);
  console.log("✅ DependabotAlerts data sent to Azure Log Analytics");
  await sendToS3(dependabotAlertsData, "DependabotAlerts");

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

    await postToAzure("CodeScanningAlerts", { ...codeScanningAlertsData, ...data });
    console.log(
      `⏱️ ${chunk.length} code scanning alerts sent to Azure Log Analytics.`
    );
  }
  console.log("✅ CodeScanningAlerts data sent to Azure Log Analytics");

  await sendToS3(codeScanningAlertsData, "CodeScanningAlerts");
  console.log("✅ CodeScanningAlerts data sent to s3");

  // Get Renovate PRs data for current repo
  const renovatePRsData = await queryRenovatePRs(octokit, owner, repo);

  // Breaks code scanning results into chunks of 10
  const renovatePRsDataChunks = renovatePRsData.renovate_prs;

  for (let i = 0; i < renovatePRsDataChunks.length; i += chunkSize) {
    const chunk = renovatePRsDataChunks.slice(i, i + chunkSize);
    let data = {
      renovate_prs: chunk,
    };

    await postToAzure("RenovatePRs", { ...renovatePRsData, ...data });
    console.log(`⏱️ ${chunk.length} renovate PRs sent to Azure Log Analytics.`);
  }
  console.log("✅ RenovatePRs data sent to Azure Log Analytics");

  // Get required files data for current branch
  const actionDependenciesData = await queryActionDependencies(owner, repo);
  await postToAzure("ActionDependencies", actionDependenciesData);
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

      await postToAzure("Users", { ...usersData, ...data });
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

      await postToAzure("Codespaces", { ...codespacesData, ...data });
      console.log(`⏱️ ${chunk.length} codespaces sent to Azure Log Analytics.`);
    }
    console.log("✅ Codespaces data sent to Azure Log Analytics");
  }
};

module.exports = {
  action: action,
};
