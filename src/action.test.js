"use strict";

const core = require("@actions/core");
const github = require("@actions/github");
require("@octokit/auth-app");
const { when } = require("jest-when");

const { action } = require("./action.js");

const { postData } = require("./lib/forwarder.js");
const {
  queryBranchProtection,
  queryCommitCount,
  queryRepository,
  queryRequiredFiles,
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
  });
});
