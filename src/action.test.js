"use strict";

const core = require("@actions/core");
const github = require("@actions/github");
const { when } = require("jest-when");

const { action } = require("./action.js");

const { postData } = require("./lib/forwarder.js");
const { queryRepository } = require("./lib/query.js");

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
      .calledWith("github-token")
      .mockReturnValue("github-token");
    when(core.getInput)
      .calledWith("log-analytics-workspace-id")
      .mockReturnValue("log-analytics-workspace-id");
    when(core.getInput)
      .calledWith("log-analytics-workspace-key")
      .mockReturnValue("log-analytics-workspace-key");

    when(github.getOctokit)
      .calledWith("github-token")
      .mockReturnValue("octokit");
    when(queryRepository)
      .calledWith("octokit", "owner", "repo")
      .mockReturnValue(sampleData);

    await action();

    expect(queryRepository).toHaveBeenCalledWith("octokit", "owner", "repo");
    expect(postData).toHaveBeenCalledWith(
      "log-analytics-workspace-id",
      "log-analytics-workspace-key",
      sampleData,
      "GitHubMetadata_Repository"
    );
  });
});
