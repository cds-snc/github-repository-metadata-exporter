"use strict";

const { when } = require("jest-when");

const {
  queryBranchProtection,
  queryCodeScanningAlerts,
  queryCommitCount,
  queryDependabotAlerts,
  queryRepository,
  queryRequiredFiles,
  queryRenovatePRs,
} = require("./query.js");

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
      metadata_branch: "main",
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
      metadata_branch: "main",
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

describe("queryCommitCount", () => {
  test("returns commit count data if the request succeeds", async () => {
    const response = {
      status: 200,
      data: [
        {
          author: {
            login: "author",
          },
          commit: {
            author: {
              date: "date",
            },
            verification: {
              verified: true,
              reason: "reason",
            },
          },
        },
        {
          author: {
            login: "author",
          },
          commit: {
            author: {
              date: "date",
            },
            verification: {
              verified: false,
              reason: "bad_signature",
            },
          },
        },
      ],
    };
    const octokit = {
      paginate: () =>
        new Promise((resolve) => {
          resolve(response.data);
        }),
      rest: {
        repos: {
          listCommits: jest.fn(),
        },
      },
    };

    const owner = "owner";
    const repo = "repo";

    when(octokit.rest.repos.listCommits)
      .calledWith({ owner: owner, repo: repo, since: expect.anything() })
      .mockReturnValue(response);

    const result = await queryCommitCount(octokit, owner, repo);
    expect(result).toEqual({
      commit_count: [
        {
          author: "author",
          date: "date",
          verified: true,
          verified_reason: "reason",
        },
        {
          author: "author",
          date: "date",
          verified: false,
          verified_reason: "bad_signature",
        },
      ],
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "commit_count",
      metadata_time_in_days: 60,
      metadata_since: expect.any(String),
    });
  });
});

describe("queryRenovatePRs", () => {
  test("returns renovate prs if the requests succeeds", async () => {
    const response = {
      status: 200,
      data: [
        {
          id: 1474610853,
          number: 1,
          title:
            "chore(deps): update js-devtools/npm-publish digest to e42e372 - autoclosed",
          created_at: "2022-12-04T08:47:37Z",
          updated_at: "2022-12-07T17:08:04Z",
          closed_at: "2022-12-07T17:08:01Z",
          pull_request: {
            html_url: "https://www.github.com/owner/repo/pull/1",
          },
        },
        {
          id: 1474610854,
          number: 2,
          title:
            "chore(deps): update all minor dependencies",
          created_at: "2022-12-04T08:47:37Z",
          updated_at: "2022-12-07T17:08:04Z",
          closed_at: null,
          pull_request: {
            html_url: "https://www.github.com/owner/repo/pull/2",
          },
        },
      ],
    };

    const octokit = {
      paginate: () =>
        new Promise((resolve) => {
          resolve(response.data);
        }),
      rest: {
        search: {
          issuesAndPullRequests: jest.fn(),
        },
      },
    };

    const owner = "owner";
    const repo = "repo";

    const result = await queryRenovatePRs(octokit, owner, repo);
    expect(result).toEqual({
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "renovate_prs",
      renovate_prs: [
        {
          id: 1474610853,
          number: 1,
          title:
            "chore(deps): update js-devtools/npm-publish digest to e42e372 - autoclosed",
          created_at: "2022-12-04T08:47:37Z",
          updated_at: "2022-12-07T17:08:04Z",
          closed_at: "2022-12-07T17:08:01Z",
          html_url: "https://www.github.com/owner/repo/pull/1",
        },
        {
          id: 1474610854,
          number: 2,
          title:
            "chore(deps): update all minor dependencies",
          created_at: "2022-12-04T08:47:37Z",
          updated_at: "2022-12-07T17:08:04Z",
          closed_at: null,
          html_url: "https://www.github.com/owner/repo/pull/2",
        },
      ],
    });
  });
});

describe("queryCodeScanningAlerts", () => {
  test("returns code scanning alerts data if the request succeeds", async () => {
    const response = {
      status: 200,
      data: [{ number: 1 }, { number: 2 }],
    };

    const octokit = {
      paginate: () =>
        new Promise((resolve) => {
          resolve(response.data);
        }),
      rest: {
        codeScanning: {
          listAlertsForRepo: jest.fn(),
        },
      },
    };

    const owner = "owner";
    const repo = "repo";

    const result = await queryCodeScanningAlerts(octokit, owner, repo);
    expect(result).toEqual({
      code_scanning_alerts: [{ number: 1 }, { number: 2 }],
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "code_scanning_alerts",
    });
  });
});

describe("queryDependabotAlerts", () => {
  test("returns dependabot alerts data if the request succeeds", async () => {
    const response = {
      status: 200,
      data: [
        {
          number: 1,
          dependency: {
            name: "dependency",
          },
          security_advisory: {
            ghsa_id: "ghsa_id",
            cve_id: "cve_id",
            severity: "severity",
            cvss: "cvss",
            cwes: "cwes",
          },
          created_at: "created_at",
        },
        {
          number: 2,
          dependency: {
            name: "dependency",
          },
          security_advisory: {
            ghsa_id: "ghsa_id",
            cve_id: "cve_id",
            severity: "severity",
            cvss: "cvss",
            cwes: "cwes",
          },
          created_at: "created_at",
        },
      ],
    };

    const octokit = {
      paginate: () =>
        new Promise((resolve) => {
          resolve(response.data);
        }),
      rest: {
        dependabot: {
          listAlertsForRepo: jest.fn(),
        },
      },
    };

    const owner = "owner";
    const repo = "repo";

    const result = await queryDependabotAlerts(octokit, owner, repo);
    expect(result).toEqual({
      dependabot_alerts: [
        {
          id: 1,
          dependency: {
            name: "dependency",
          },
          ghsa_id: "ghsa_id",
          cve_id: "cve_id",
          severity: "severity",
          cvss: "cvss",
          cwes: "cwes",
          created_at: "created_at",
        },
        {
          id: 2,
          dependency: {
            name: "dependency",
          },
          ghsa_id: "ghsa_id",
          cve_id: "cve_id",
          severity: "severity",
          cvss: "cvss",
          cwes: "cwes",
          created_at: "created_at",
        },
      ],
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "dependabot_alerts",
    });
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

describe("queryRequiredFiles", () => {
  test("returns repository data if the app has access", async () => {
    const owner = "owner";
    const repo = "repo";

    const result = await queryRequiredFiles(owner, repo);
    expect(result).toEqual({
      "CODE_OF_CONDUCT.md": false,
      "CONTRIBUTING.md": false,
      LICENSE: true,
      "README.md": true,
      "SECURITY.md": false,
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "required_files",
    });
  });
});
