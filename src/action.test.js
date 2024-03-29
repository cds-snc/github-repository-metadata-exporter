"use strict";

const core = require("@actions/core");
const github = require("@actions/github");
require("@octokit/auth-app");
const { when } = require("jest-when");

const { action } = require("./action.js");

const { postData } = require("./lib/forwarder.js");
const {
  queryActionDependencies,
  queryBranchProtection,
  queryCodeScanningAlerts,
  queryCodespaces,
  queryCommitCount,
  queryDependabotAlerts,
  queryRepository,
  queryRequiredFiles,
  queryRenovatePRs,
  queryUsers,
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
  beforeEach(() => {
    jest.resetAllMocks();
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

    when(github.getOctokit).calledWith("token").mockReturnValue("octokit");

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
});
