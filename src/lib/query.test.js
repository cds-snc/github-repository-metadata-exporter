"use strict";

const { when } = require("jest-when");

const { queryBranchProtection, queryRepository } = require("./query.js");

describe("queryBranchProtection", () => {
  test("returns branch protection data if the request succeeds", async () => {
    const octokit = {
      rest: {
        repos: {
          getBranchProtection: jest.fn(),
        },
      },
    };

    const response = {
      status: 200,
      data: {
        id: "123",
      },
    };

    const owner = "owner";
    const repo = "repo";
    const branch = "main";

    when(octokit.rest.repos.getBranchProtection)
      .calledWith({ branch: branch, owner: owner, repo: repo })
      .mockReturnValue(response);

    const result = await queryBranchProtection(octokit, owner, repo, branch);
    expect(result).toEqual({
      id: "123",
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "branch_protection",
    });
  });

  test("returns branch protection data false if 404", async () => {
    const octokit = {
      rest: {
        repos: {
          getBranchProtection: jest.fn(),
        },
      },
    };

    const response = {
      status: 404,
    };

    const owner = "owner";
    const repo = "repo";
    const branch = "main";

    when(octokit.rest.repos.getBranchProtection)
      .calledWith({ branch: branch, owner: owner, repo: repo })
      .mockReturnValue(response);

    const result = await queryBranchProtection(octokit, owner, repo, branch);
    expect(result).toEqual({
      branch: "main",
      enabled: false,
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "branch_protection",
    });
  });

  test("throws an error if the request fails", async () => {
    const octokit = {
      rest: {
        repos: {
          getBranchProtection: jest.fn(),
        },
      },
    };

    const response = {
      status: 400,
    };

    const owner = "owner";
    const repo = "repo";
    const branch = "main";

    when(octokit.rest.repos.getBranchProtection)
      .calledWith({ branch: branch, owner: owner, repo: repo })
      .mockReturnValue(response);

    await expect(
      queryBranchProtection(octokit, owner, repo, branch)
    ).rejects.toThrow(
      `Failed to get branch protection for ${branch} on ${owner}/${repo}: ${response.status}`
    );
  });
});

describe("queryRepository", () => {
  test("returns repository data if the request succeeds", async () => {
    const octokit = {
      rest: {
        repos: {
          get: jest.fn(),
        },
      },
    };

    const response = {
      status: 200,
      data: {
        id: "123",
      },
    };

    const owner = "owner";
    const repo = "repo";

    when(octokit.rest.repos.get)
      .calledWith({ owner: owner, repo: repo })
      .mockReturnValue(response);

    const result = await queryRepository(octokit, owner, repo);
    expect(result).toEqual({
      id: "123",
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "repository",
    });
  });

  test("throws an error if the request fails", async () => {
    const octokit = {
      rest: {
        repos: {
          get: jest.fn(),
        },
      },
    };

    const response = {
      status: 400,
    };

    const owner = "owner";
    const repo = "repo";

    when(octokit.rest.repos.get)
      .calledWith({ owner: owner, repo: repo })
      .mockReturnValue(response);

    await expect(queryRepository(octokit, owner, repo)).rejects.toThrow(
      `Error querying repository ${owner}/${repo}: ${response.status}`
    );
  });
});
