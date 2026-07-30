"use strict";

const core = require("@actions/core");
const github = require("@actions/github");
const { createAppAuth } = require("@octokit/auth-app");

const { postData, postDataDcr, uploadToS3 } = require("./lib/forwarder.js");
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

const forwarderMode = {
  legacy: "legacy",
  dcr: "dcr",
};

const normalizeMode = (modeInput = "") =>
  modeInput.trim().toLowerCase() || forwarderMode.legacy;

const getMissingKeys = (config, keys) =>
  keys.filter((key) => !config[key] || !config[key].trim());

const validateForwarderConfiguration = (mode, config) => {
  if (![forwarderMode.legacy, forwarderMode.dcr].includes(mode)) {
    throw new Error(
      `Invalid forwarder mode \"${mode}\". Supported modes are \"legacy\" and \"dcr\".`
    );
  }

  if (mode === forwarderMode.legacy) {
    const missingLegacyKeys = getMissingKeys(config, [
      "logAnalyticsWorkspaceId",
      "logAnalyticsWorkspaceKey",
    ]);

    if (missingLegacyKeys.length > 0) {
      throw new Error(
        `Missing required legacy forwarding input(s): ${missingLegacyKeys.join(
          ", "
        )}. Provide both log-analytics-workspace-id and log-analytics-workspace-key, or set forwarder-mode to dcr.`
      );
    }

    return;
  }

  const missingDcrKeys = getMissingKeys(config, [
    "azureDceEndpoint",
    "azureDcrImmutableId",
    "azureDcrStreamName",
  ]);

  if (missingDcrKeys.length > 0) {
    throw new Error(
      `Missing required DCR forwarding input(s): ${missingDcrKeys.join(
        ", "
      )}. Provide azure-dce-endpoint, azure-dcr-immutable-id, and azure-dcr-stream-name when forwarder-mode is dcr.`
    );
  }

  const hasToken = !!(
    config.azureMonitorIngestionToken &&
    config.azureMonitorIngestionToken.trim()
  );
  const hasAnyServicePrincipalInput =
    !!(config.azureTenantId && config.azureTenantId.trim()) ||
    !!(config.azureClientId && config.azureClientId.trim()) ||
    !!(config.azureClientSecret && config.azureClientSecret.trim());
  const missingServicePrincipalKeys = getMissingKeys(config, [
    "azureTenantId",
    "azureClientId",
    "azureClientSecret",
  ]);

  if (!hasToken && !hasAnyServicePrincipalInput) {
    throw new Error(
      "Missing Azure authentication for DCR forwarding. Provide azure-monitor-ingestion-token, or provide all of azure-tenant-id, azure-client-id, and azure-client-secret."
    );
  }

  if (!hasToken && missingServicePrincipalKeys.length > 0) {
    throw new Error(
      `Incomplete Azure service principal configuration for DCR forwarding: ${missingServicePrincipalKeys.join(
        ", "
      )}. Provide all of azure-tenant-id, azure-client-id, and azure-client-secret, or use azure-monitor-ingestion-token.`
    );
  }
};

const action = async () => {
  const logAnalyticsWorkspaceId = core.getInput("log-analytics-workspace-id");
  const logAnalyticsWorkspaceKey = core.getInput("log-analytics-workspace-key");
  const selectedForwarderMode = normalizeMode(core.getInput("forwarder-mode"));
  const azureDceEndpoint = core.getInput("azure-dce-endpoint");
  const azureDcrImmutableId = core.getInput("azure-dcr-immutable-id");
  const azureDcrStreamName = core.getInput("azure-dcr-stream-name");
  const azureMonitorIngestionToken = core.getInput(
    "azure-monitor-ingestion-token"
  );
  const azureTenantId = core.getInput("azure-tenant-id");
  const azureClientId = core.getInput("azure-client-id");
  const azureClientSecret = core.getInput("azure-client-secret");

  const githubAppId = core.getInput("github-app-id");
  const githubAppInstallationId = core.getInput("github-app-installation-id");
  const githubAppPrivateKey = core.getInput("github-app-private-key");

  const orgDataRepo = core.getInput("org-data-repo");

  // S3 config from action parameters (set via secrets)
  const s3Bucket =
    core.getInput("s3-bucket") ||
    "cds-data-lake-raw-production/operations/github";
  const awsRegion = core.getInput("aws-region") || "ca-central-1";

  const forwarderConfiguration = {
    logAnalyticsWorkspaceId,
    logAnalyticsWorkspaceKey,
    azureDceEndpoint,
    azureDcrImmutableId,
    azureDcrStreamName,
    azureMonitorIngestionToken,
    azureTenantId,
    azureClientId,
    azureClientSecret,
  };

  validateForwarderConfiguration(selectedForwarderMode, forwarderConfiguration);

  const hasLegacyInputs =
    !!(logAnalyticsWorkspaceId && logAnalyticsWorkspaceId.trim()) ||
    !!(logAnalyticsWorkspaceKey && logAnalyticsWorkspaceKey.trim());
  const hasDcrInputs =
    !!(azureDceEndpoint && azureDceEndpoint.trim()) ||
    !!(azureDcrImmutableId && azureDcrImmutableId.trim()) ||
    !!(azureDcrStreamName && azureDcrStreamName.trim()) ||
    !!(azureMonitorIngestionToken && azureMonitorIngestionToken.trim()) ||
    !!(azureTenantId && azureTenantId.trim()) ||
    !!(azureClientId && azureClientId.trim()) ||
    !!(azureClientSecret && azureClientSecret.trim());

  if (selectedForwarderMode === forwarderMode.legacy && hasDcrInputs) {
    console.log(
      "ℹ️ DCR inputs were provided but forwarder-mode is legacy. DCR inputs will be ignored."
    );
  }

  if (selectedForwarderMode === forwarderMode.dcr && hasLegacyInputs) {
    console.log(
      "ℹ️ Legacy Log Analytics inputs were provided but forwarder-mode is dcr. Legacy inputs will be ignored."
    );
  }

  const forwardDataToAzure =
    selectedForwarderMode === forwarderMode.legacy
      ? async (data, logType) =>
        postData(
          logAnalyticsWorkspaceId,
          logAnalyticsWorkspaceKey,
          data,
          logType
        )
      : async (data) =>
        postDataDcr(
          {
            azureDceEndpoint,
            azureDcrImmutableId,
            azureDcrStreamName,
            azureMonitorIngestionToken,
            azureTenantId,
            azureClientId,
            azureClientSecret,
          },
          data
        );

  const azureDestinationName =
    selectedForwarderMode === forwarderMode.legacy
      ? "Azure Log Analytics"
      : "Azure Monitor DCE/DCR";

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

  // Get repository data
  const repository = await queryRepository(octokit, owner, repo);
  await forwardDataToAzure(repository, prefix + "Repository");
  console.log(`✅ Repository data sent to ${azureDestinationName}`);

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
  await forwardDataToAzure(branchProtectionData, prefix + "BranchProtection");
  console.log(`✅ BranchProtection data sent to ${azureDestinationName}`);

  // Get commit data
  // Send commit counts to Log Analytics and full commit data to S3
  const commitData = await queryCommits(octokit, owner, repo);
  const { commits, ...commitCounts } = commitData; // eslint-disable-line no-unused-vars
  const { commit_count, ...commitsFull } = commitData; // eslint-disable-line no-unused-vars
  await forwardDataToAzure(commitCounts, prefix + "CommitCount");
  console.log(`✅ CommitCount data sent to ${azureDestinationName}`);
  await sendToS3(commitsFull, "Commits");

  // Get required files data for current branch
  const requiredFilesData = await queryRequiredFiles(owner, repo);
  await forwardDataToAzure(requiredFilesData, prefix + "RequiredFiles");
  console.log(`✅ RequiredFiles data sent to ${azureDestinationName}`);

  // Get dependabot alerts data for current branch
  const dependabotAlertsData = await queryDependabotAlerts(
    octokit,
    owner,
    repo
  );
  await forwardDataToAzure(dependabotAlertsData, prefix + "DependabotAlerts");
  console.log(`✅ DependabotAlerts data sent to ${azureDestinationName}`);
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

    await forwardDataToAzure(
      { ...codeScanningAlertsData, ...data },
      prefix + "CodeScanningAlerts"
    );
    console.log(
      `⏱️ ${chunk.length} code scanning alerts sent to ${azureDestinationName}.`
    );
  }
  console.log(`✅ CodeScanningAlerts data sent to ${azureDestinationName}`);

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

    await forwardDataToAzure(
      { ...renovatePRsData, ...data },
      prefix + "RenovatePRs"
    );
    console.log(`⏱️ ${chunk.length} renovate PRs sent to ${azureDestinationName}.`);
  }
  console.log(`✅ RenovatePRs data sent to ${azureDestinationName}`);

  // Get required files data for current branch
  const actionDependenciesData = await queryActionDependencies(owner, repo);
  await forwardDataToAzure(actionDependenciesData, prefix + "ActionDependencies");
  console.log(`✅ ActionDependencies data sent to ${azureDestinationName}`);

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

      await forwardDataToAzure({ ...usersData, ...data }, prefix + "Users");
      console.log(`⏱️ ${chunk.length} users sent to ${azureDestinationName}.`);
    }
    console.log(`✅ Users data sent to ${azureDestinationName}`);

    // Get codespaces data from org
    console.log("🖥️ Getting codespaces data");
    const codespacesData = await queryCodespaces(octokit, owner);

    const codespacesDataChunks = codespacesData.codespaces;

    for (let i = 0; i < codespacesDataChunks.length; i += chunkSize) {
      const chunk = codespacesDataChunks.slice(i, i + chunkSize);
      let data = {
        codespaces: chunk,
      };

      await forwardDataToAzure(
        { ...codespacesData, ...data },
        prefix + "Codespaces"
      );
      console.log(`⏱️ ${chunk.length} codespaces sent to ${azureDestinationName}.`);
    }
    console.log(`✅ Codespaces data sent to ${azureDestinationName}`);
  }
};

module.exports = {
  action: action,
};
