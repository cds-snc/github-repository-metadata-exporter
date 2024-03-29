"use strict";

const { when } = require("jest-when");

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
} = require("./query.js");

describe("queryActionDependencies", () => {
  test("returns action dependencies for a repository", async () => {
    const result = await queryActionDependencies("owner", "repo");

    expect(result).toEqual({
      metadata_owner: "owner",
      metadata_repo: "repo",
      metadata_query: "action_dependencies",
      action_dependencies: expect.any(Array),
    });
  });
});

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
      .mockRejectedValue(response);

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
      .mockRejectedValue(response);

    await expect(
      queryBranchProtection(octokit, owner, repo, branch)
    ).rejects.toThrow(
      `Failed to get branch protection for ${branch} on ${owner}/${repo}: ${response.status}`
    );
  });
});

describe("queryCodespaces", () => {
  test("returns org codespaces data if the request succeeds", async () => {
    const response = {
      status: 200,
      data: [
        {
          id: 123,
          name: "name",
          environment_id: "environment_id",
          owner: { login: "owner" },
          billable_owner: { login: "billable_owner" },
          repository: { full_name: "full_name" },
          machine: {
            name: "machine_name",
            display_name: "display_name",
            operating_system: "os",
            storage_in_bytes: 123,
            memory_in_bytes: 123,
            cpus: 123,
          },
          prebuild: "prebuild",
          devcontainer_path: "devcontainer_path",
          created_at: "created_at",
          updated_at: "updated_at",
          last_used_at: "last_used_at",
          state: "state",
          location: "location",
          idle_timeout_minutes: 123,
        },
        {
          id: 456,
          name: "name",
          environment_id: "environment_id",
          owner: { login: "owner" },
          billable_owner: { login: "billable_owner" },
          repository: { full_name: "full_name" },
          machine: {
            name: "machine_name",
            display_name: "display_name",
            operating_system: "os",
            storage_in_bytes: 123,
            memory_in_bytes: 123,
            cpus: 123,
          },
          prebuild: "prebuild",
          devcontainer_path: "devcontainer_path",
          created_at: "created_at",
          updated_at: "updated_at",
          last_used_at: "last_used_at",
          state: "state",
          location: "location",
          idle_timeout_minutes: 123,
        },
      ],
    };

    const octokit = {
      paginate: () =>
        new Promise((resolve) => {
          resolve(response.data);
        }),
      rest: {
        codespaces: {
          listInOrganization: jest.fn(),
        },
      },
    };

    const owner = "owner";

    when(octokit.rest.codespaces.listInOrganization)
      .calledWith({ orgs: owner })
      .mockReturnValue(response);

    const result = await queryCodespaces(octokit, owner);

    expect(result).toEqual({
      codespaces: [
        {
          id: 123,
          name: "name",
          environment_id: "environment_id",
          owner: "owner",
          billable_owner: "billable_owner",
          repository: "full_name",
          machine_name: "machine_name",
          machine_display_name: "display_name",
          machine_os: "os",
          machine_storage_in_bytes: 123,
          machine_memory_in_bytes: 123,
          machine_cpus: 123,
          prebuild: "prebuild",
          devcontainer_path: "devcontainer_path",
          created_at: "created_at",
          updated_at: "updated_at",
          last_used_at: "last_used_at",
          state: "state",
          location: "location",
          idle_timeout_minutes: 123,
        },
        {
          id: 456,
          name: "name",
          environment_id: "environment_id",
          owner: "owner",
          billable_owner: "billable_owner",
          repository: "full_name",
          machine_name: "machine_name",
          machine_display_name: "display_name",
          machine_os: "os",
          machine_storage_in_bytes: 123,
          machine_memory_in_bytes: 123,
          machine_cpus: 123,
          prebuild: "prebuild",
          devcontainer_path: "devcontainer_path",
          created_at: "created_at",
          updated_at: "updated_at",
          last_used_at: "last_used_at",
          state: "state",
          location: "location",
          idle_timeout_minutes: 123,
        },
      ],
      metadata_owner: "owner",
      metadata_query: "codespaces",
    });
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
          title: "chore(deps): update all minor dependencies",
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
          title: "chore(deps): update all minor dependencies",
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

  test("returns no code scanning alerts if 404", async () => {
    const octokit = {
      paginate: () =>
        new Promise((_, rejects) => {
          rejects({
            status: 404,
          });
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
      metadata_owner: "owner",
      metadata_repo: "repo",
      code_scanning_alerts: [],
      metadata_query: "code_scanning_alerts",
    });
  });

  test("throws an error if the request fails", async () => {
    const octokit = {
      paginate: () =>
        new Promise((_, rejects) => {
          rejects({
            status: 400,
          });
        }),
      rest: {
        codeScanning: {
          listAlertsForRepo: jest.fn(),
        },
      },
    };

    const owner = "owner";
    const repo = "repo";

    await expect(queryCodeScanningAlerts(octokit, owner, repo)).rejects.toThrow(
      `Failed to get code scanning alerts for ${owner}/${repo}: 400`
    );
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

describe("queryUsers", () => {
  test("returns org user data if the request succeeds", async () => {
    const response = {
      status: 200,
      data: [
        {
          id: "123",
          login: "login",
          node_id: "node_id",
          avatar_url: "avatar_url",
          gravatar_id: "gravatar_id",
          type: "type",
          site_admin: "site_admin",
        },
        {
          id: "456",
          login: "login",
          node_id: "node_id",
          avatar_url: "avatar_url",
          gravatar_id: "gravatar_id",
          type: "type",
          site_admin: "site_admin",
        },
      ],
    };

    const octokit = {
      paginate: () =>
        new Promise((resolve) => {
          resolve(response.data);
        }),
      rest: {
        orgs: {
          listMembers: jest.fn(),
        },
      },
    };

    const owner = "owner";

    when(octokit.rest.orgs.listMembers)
      .calledWith({ orgs: owner })
      .mockReturnValue(response);

    const result = await queryUsers(octokit, owner);

    expect(result).toEqual({
      users: response.data,
      metadata_owner: "owner",
      metadata_query: "users",
    });
  });
});
