"use strict";

const core = require("@actions/core");
const github = require("@actions/github");
require("@octokit/auth-app");
const { when } = require("jest-when");

const { action } = require("./action.js");

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
  queryWorkflows,
} = require("./lib/query.js");

jest.mock("@actions/core");
jest.mock("@actions/github", () => ({
  context: {
    repo: {
      owner: "owner",
      repo: "repo",
    },
  },
  getOctokit: jest.fn(),
}));
jest.mock("@octokit/auth-app", () => ({
  createAppAuth: () => () => ({
    type: "app",
    token: "token",
  }),
}));
jest.mock("./lib/forwarder.js");
jest.mock("./lib/query.js");

describe("action", () => {
  let consoleLogSpy;

  beforeEach(() => {
    jest.resetAllMocks();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test("default flow", async () => {
    const sampleData = {
      id: "123",
    };

    when(core.getInput)
      .calledWith("log-analytics-workspace-id")
      .mockReturnValue("log-analytics-workspace-id");
    when(core.getInput)
      .calledWith("log-analytics-workspace-key")
      .mockReturnValue("log-analytics-workspace-key");
    when(core.getInput)
      .calledWith("github-app-id")
      .mockReturnValue("github-app-id");
    when(core.getInput)
      .calledWith("github-app-installation-id")
      .mockReturnValue("github-app-installation-id");
    when(core.getInput)
      .calledWith("github-app-private-key")
      .mockReturnValue("github-app-private-key");
    when(core.getInput)
      .calledWith("org-data-repo")
      .mockReturnValue("owner/repo");
    when(core.getInput).calledWith("s3-bucket").mockReturnValue("");
    when(core.getInput).calledWith("aws-region").mockReturnValue("");

    when(github.getOctokit).calledWith("token").mockReturnValue("octokit");

    queryAllPRs.mockResolvedValue(sampleData);
    queryWorkflows.mockResolvedValue(sampleData);
    uploadToS3.mockResolvedValue(true);

    when(queryRepository)
      .calledWith("octokit", "owner", "repo")
      .mockReturnValue(sampleData);
    when(queryBranchProtection)
      .calledWith("octokit", "owner", "repo", "main")
      .mockReturnValue(sampleData);
    when(queryCommitCount)
      .calledWith("octokit", "owner", "repo")
      .mockReturnValue(sampleData);
    when(queryRequiredFiles)
      .calledWith("owner", "repo")
      .mockReturnValue(sampleData);
    when(queryDependabotAlerts)
      .calledWith("octokit", "owner", "repo")
      .mockReturnValue(sampleData);

    const dataSize = 75;
    const chunkSize = 10;

    const codeScanningData = {
      metadata_owner: "cds-snc",
      metadata_repo: "github-repository-metadata-exporter",
      metadata_query: "code_scanning_alerts",
      code_scanning_alerts: Array.from(Array(dataSize).keys()),
    };

    const renovatePRsData = {
      metadata_owner: "cds-snc",
      metadata_repo: "github-repository-metadata-exporter",
      metadata_query: "renovate_prs",
      renovate_prs: Array.from(Array(dataSize).keys()),
    };

    const usersData = {
      metadata_owner: "cds-snc",
      metadata_query: "users",
      users: Array.from(Array(dataSize).keys()),
    };

    const codespacesData = {
      metadata_owner: "cds-snc",
      metadata_query: "codespaces",
      codespaces: Array.from(Array(dataSize).keys()),
    };

    when(queryCodeScanningAlerts)
      .calledWith("octokit", "owner", "repo")
      .mockReturnValue(codeScanningData);

    when(queryRenovatePRs)
      .calledWith("octokit", "owner", "repo")
      .mockReturnValue(renovatePRsData);

    when(queryActionDependencies)
      .calledWith("owner", "repo")
      .mockReturnValue(sampleData);

    when(queryUsers).calledWith("octokit", "owner").mockReturnValue(usersData);

    when(queryCodespaces)
      .calledWith("octokit", "owner")
      .mockReturnValue(codespacesData);

    await action();

    expect(queryRepository).toHaveBeenCalledWith("octokit", "owner", "repo");
    expect(postData).toHaveBeenCalledWith(
      "log-analytics-workspace-id",
      "log-analytics-workspace-key",
      sampleData,
      "GitHubMetadata_Repository"
    );

    expect(queryBranchProtection).toHaveBeenCalledWith(
      "octokit",
      "owner",
      "repo",
      "main"
    );
    expect(postData).toHaveBeenCalledWith(
      "log-analytics-workspace-id",
      "log-analytics-workspace-key",
      sampleData,
      "GitHubMetadata_BranchProtection"
    );

    expect(queryCommitCount).toHaveBeenCalledWith("octokit", "owner", "repo");
    expect(postData).toHaveBeenCalledWith(
      "log-analytics-workspace-id",
      "log-analytics-workspace-key",
      sampleData,
      "GitHubMetadata_CommitCount"
    );

    expect(queryRequiredFiles).toHaveBeenCalledWith("owner", "repo");
    expect(postData).toHaveBeenCalledWith(
      "log-analytics-workspace-id",
      "log-analytics-workspace-key",
      sampleData,
      "GitHubMetadata_RequiredFiles"
    );

    expect(queryDependabotAlerts).toHaveBeenCalled();
    expect(postData).toHaveBeenCalledWith(
      "log-analytics-workspace-id",
      "log-analytics-workspace-key",
      sampleData,
      "GitHubMetadata_DependabotAlerts"
    );

    expect(queryRenovatePRs).toHaveBeenCalled();
    for (let index = 0; index < dataSize; index += chunkSize) {
      expect(postData).toHaveBeenCalledWith(
        "log-analytics-workspace-id",
        "log-analytics-workspace-key",
        {
          metadata_owner: "cds-snc",
          metadata_repo: "github-repository-metadata-exporter",
          metadata_query: "renovate_prs",
          renovate_prs: renovatePRsData.renovate_prs.slice(
            index,
            index + chunkSize
          ),
        },
        "GitHubMetadata_RenovatePRs"
      );
    }

    expect(queryCodeScanningAlerts).toHaveBeenCalled();
    for (let index = 0; index < dataSize; index += chunkSize) {
      expect(postData).toHaveBeenCalledWith(
        "log-analytics-workspace-id",
        "log-analytics-workspace-key",
        {
          metadata_owner: "cds-snc",
          metadata_repo: "github-repository-metadata-exporter",
          metadata_query: "code_scanning_alerts",
          code_scanning_alerts: codeScanningData.code_scanning_alerts.slice(
            index,
            index + chunkSize
          ),
        },
        "GitHubMetadata_CodeScanningAlerts"
      );
    }

    expect(queryActionDependencies).toHaveBeenCalledWith("owner", "repo");
    expect(postData).toHaveBeenCalledWith(
      "log-analytics-workspace-id",
      "log-analytics-workspace-key",
      sampleData,
      "GitHubMetadata_ActionDependencies"
    );

    expect(queryUsers).toHaveBeenCalled();
    for (let index = 0; index < dataSize; index += chunkSize) {
      expect(postData).toHaveBeenCalledWith(
        "log-analytics-workspace-id",
        "log-analytics-workspace-key",
        {
          metadata_owner: "cds-snc",
          metadata_query: "users",
          users: usersData.users.slice(index, index + chunkSize),
        },
        "GitHubMetadata_Users"
      );
    }

    expect(queryCodespaces).toHaveBeenCalled();
    for (let index = 0; index < dataSize; index += chunkSize) {
      expect(postData).toHaveBeenCalledWith(
        "log-analytics-workspace-id",
        "log-analytics-workspace-key",
        {
          metadata_owner: "cds-snc",
          metadata_query: "codespaces",
          codespaces: codespacesData.codespaces.slice(index, index + chunkSize),
        },
        "GitHubMetadata_Codespaces"
      );
    }
  });

  test("skips org data when repo is not org-data-repo", async () => {
    const sampleData = { id: "123" };

    when(core.getInput)
      .calledWith("log-analytics-workspace-id")
      .mockReturnValue("workspace-id");
    when(core.getInput)
      .calledWith("log-analytics-workspace-key")
      .mockReturnValue("workspace-key");
    when(core.getInput).calledWith("github-app-id").mockReturnValue("app-id");
    when(core.getInput)
      .calledWith("github-app-installation-id")
      .mockReturnValue("installation-id");
    when(core.getInput)
      .calledWith("github-app-private-key")
      .mockReturnValue("private-key");
    when(core.getInput)
      .calledWith("org-data-repo")
      .mockReturnValue("different/repo");
    when(core.getInput).calledWith("s3-bucket").mockReturnValue("");
    when(core.getInput).calledWith("aws-region").mockReturnValue("");

    when(github.getOctokit).calledWith("token").mockReturnValue("octokit");

    queryRepository.mockResolvedValue(sampleData);
    queryAllPRs.mockResolvedValue(sampleData);
    queryWorkflows.mockResolvedValue(sampleData);
    queryBranchProtection.mockResolvedValue(sampleData);
    queryCommitCount.mockResolvedValue(sampleData);
    queryRequiredFiles.mockResolvedValue(sampleData);
    queryDependabotAlerts.mockResolvedValue(sampleData);
    queryCodeScanningAlerts.mockResolvedValue({ code_scanning_alerts: [] });
    queryRenovatePRs.mockResolvedValue({ renovate_prs: [] });
    queryActionDependencies.mockResolvedValue(sampleData);
    uploadToS3.mockResolvedValue(true);

    await action();

    expect(queryUsers).not.toHaveBeenCalled();
    expect(queryCodespaces).not.toHaveBeenCalled();
  });

  test("uploads data to S3 with custom bucket and region", async () => {
    const sampleData = { id: "123" };
    const customBucket = "custom-bucket/path";
    const customRegion = "us-east-1";

    when(core.getInput)
      .calledWith("log-analytics-workspace-id")
      .mockReturnValue("workspace-id");
    when(core.getInput)
      .calledWith("log-analytics-workspace-key")
      .mockReturnValue("workspace-key");
    when(core.getInput).calledWith("github-app-id").mockReturnValue("app-id");
    when(core.getInput)
      .calledWith("github-app-installation-id")
      .mockReturnValue("installation-id");
    when(core.getInput)
      .calledWith("github-app-private-key")
      .mockReturnValue("private-key");
    when(core.getInput)
      .calledWith("org-data-repo")
      .mockReturnValue("different/repo");
    when(core.getInput).calledWith("s3-bucket").mockReturnValue(customBucket);
    when(core.getInput).calledWith("aws-region").mockReturnValue(customRegion);

    when(github.getOctokit).calledWith("token").mockReturnValue("octokit");

    queryRepository.mockResolvedValue(sampleData);
    queryAllPRs.mockResolvedValue(sampleData);
    queryWorkflows.mockResolvedValue(sampleData);
    queryBranchProtection.mockResolvedValue(sampleData);
    queryCommitCount.mockResolvedValue(sampleData);
    queryRequiredFiles.mockResolvedValue(sampleData);
    queryDependabotAlerts.mockResolvedValue(sampleData);
    queryCodeScanningAlerts.mockResolvedValue({ code_scanning_alerts: [] });
    queryRenovatePRs.mockResolvedValue({ renovate_prs: [] });
    queryActionDependencies.mockResolvedValue(sampleData);
    uploadToS3.mockResolvedValue(true);

    await action();

    expect(uploadToS3).toHaveBeenCalledWith(
      customBucket,
      expect.stringContaining("CommitCount/"),
      sampleData,
      customRegion
    );
    expect(uploadToS3).toHaveBeenCalledWith(
      customBucket,
      expect.stringContaining("DependabotAlerts/"),
      sampleData,
      customRegion
    );
  });

  test("continues workflow when S3 upload fails", async () => {
    const sampleData = { id: "123" };

    when(core.getInput)
      .calledWith("log-analytics-workspace-id")
      .mockReturnValue("workspace-id");
    when(core.getInput)
      .calledWith("log-analytics-workspace-key")
      .mockReturnValue("workspace-key");
    when(core.getInput).calledWith("github-app-id").mockReturnValue("app-id");
    when(core.getInput)
      .calledWith("github-app-installation-id")
      .mockReturnValue("installation-id");
    when(core.getInput)
      .calledWith("github-app-private-key")
      .mockReturnValue("private-key");
    when(core.getInput)
      .calledWith("org-data-repo")
      .mockReturnValue("different/repo");
    when(core.getInput).calledWith("s3-bucket").mockReturnValue("");
    when(core.getInput).calledWith("aws-region").mockReturnValue("");

    when(github.getOctokit).calledWith("token").mockReturnValue("octokit");

    queryRepository.mockResolvedValue(sampleData);
    queryAllPRs.mockResolvedValue(sampleData);
    queryWorkflows.mockResolvedValue(sampleData);
    queryBranchProtection.mockResolvedValue(sampleData);
    queryCommitCount.mockResolvedValue(sampleData);
    queryRequiredFiles.mockResolvedValue(sampleData);
    queryDependabotAlerts.mockResolvedValue(sampleData);
    queryCodeScanningAlerts.mockResolvedValue({ code_scanning_alerts: [] });
    queryRenovatePRs.mockResolvedValue({ renovate_prs: [] });
    queryActionDependencies.mockResolvedValue(sampleData);
    uploadToS3.mockRejectedValue(new Error("S3 upload failed"));

    await expect(action()).resolves.not.toThrow();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("⚠️ Failed to send")
    );
  });

  test("continues workflow when queryAllPRs fails", async () => {
    const sampleData = { id: "123" };

    when(core.getInput)
      .calledWith("log-analytics-workspace-id")
      .mockReturnValue("workspace-id");
    when(core.getInput)
      .calledWith("log-analytics-workspace-key")
      .mockReturnValue("workspace-key");
    when(core.getInput).calledWith("github-app-id").mockReturnValue("app-id");
    when(core.getInput)
      .calledWith("github-app-installation-id")
      .mockReturnValue("installation-id");
    when(core.getInput)
      .calledWith("github-app-private-key")
      .mockReturnValue("private-key");
    when(core.getInput)
      .calledWith("org-data-repo")
      .mockReturnValue("different/repo");
    when(core.getInput).calledWith("s3-bucket").mockReturnValue("");
    when(core.getInput).calledWith("aws-region").mockReturnValue("");

    when(github.getOctokit).calledWith("token").mockReturnValue("octokit");

    queryRepository.mockResolvedValue(sampleData);
    queryAllPRs.mockRejectedValue(new Error("API error"));
    queryWorkflows.mockResolvedValue(sampleData);
    queryBranchProtection.mockResolvedValue(sampleData);
    queryCommitCount.mockResolvedValue(sampleData);
    queryRequiredFiles.mockResolvedValue(sampleData);
    queryDependabotAlerts.mockResolvedValue(sampleData);
    queryCodeScanningAlerts.mockResolvedValue({ code_scanning_alerts: [] });
    queryRenovatePRs.mockResolvedValue({ renovate_prs: [] });
    queryActionDependencies.mockResolvedValue(sampleData);
    uploadToS3.mockResolvedValue(true);

    await expect(action()).resolves.not.toThrow();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("⚠️ Failed to get AllPRs data")
    );
  });

  test("continues workflow when queryWorkflows fails", async () => {
    const sampleData = { id: "123" };

    when(core.getInput)
      .calledWith("log-analytics-workspace-id")
      .mockReturnValue("workspace-id");
    when(core.getInput)
      .calledWith("log-analytics-workspace-key")
      .mockReturnValue("workspace-key");
    when(core.getInput).calledWith("github-app-id").mockReturnValue("app-id");
    when(core.getInput)
      .calledWith("github-app-installation-id")
      .mockReturnValue("installation-id");
    when(core.getInput)
      .calledWith("github-app-private-key")
      .mockReturnValue("private-key");
    when(core.getInput)
      .calledWith("org-data-repo")
      .mockReturnValue("different/repo");
    when(core.getInput).calledWith("s3-bucket").mockReturnValue("");
    when(core.getInput).calledWith("aws-region").mockReturnValue("");

    when(github.getOctokit).calledWith("token").mockReturnValue("octokit");

    queryRepository.mockResolvedValue(sampleData);
    queryAllPRs.mockResolvedValue(sampleData);
    queryWorkflows.mockRejectedValue(new Error("Workflows API error"));
    queryBranchProtection.mockResolvedValue(sampleData);
    queryCommitCount.mockResolvedValue(sampleData);
    queryRequiredFiles.mockResolvedValue(sampleData);
    queryDependabotAlerts.mockResolvedValue(sampleData);
    queryCodeScanningAlerts.mockResolvedValue({ code_scanning_alerts: [] });
    queryRenovatePRs.mockResolvedValue({ renovate_prs: [] });
    queryActionDependencies.mockResolvedValue(sampleData);
    uploadToS3.mockResolvedValue(true);

    await expect(action()).resolves.not.toThrow();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("⚠️ Failed to get Workflows data")
    );
  });
});
