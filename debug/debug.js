"use strict";

const github = require("@actions/github");
const { createAppAuth } = require("@octokit/auth-app");

const { queryBranchProtection, queryCommitCount, queryDependabotAlerts, queryRepository, queryRequiredFiles } = require("../src/lib/query.js");

const run = async () => {

    const githubAppId = process.env.GITHUB_APP_ID;
    const githubAppInstallationId = process.env.GITHUB_APP_INSTALLATION_ID;
    const githubAppPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY;

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

    // Get repository data
    const repository = await queryRepository(octokit, owner, repo);
    console.log("Repository data");
    console.log("===============");
    console.log(repository);

    // Get branch protection data for main branch
    const branchProtectionData = await queryBranchProtection(octokit, owner, repo, "main");
    console.log("Branch protection data");
    console.log("======================");
    console.log(branchProtectionData);

    // Get commit count data
    const commitCountData = await queryCommitCount(octokit, owner, repo);
    console.log("Commit count data");
    console.log("======================");
    console.log(commitCountData);

    // Get required files data
    const requiredFilesData = await queryRequiredFiles(owner, repo);
    console.log("Required files data");
    console.log("======================");
    console.log(requiredFilesData);

    // Get dependabot alerts data
    const dependabotAlertsData = await queryDependabotAlerts(octokit, "cds-snc", "security-tools");
    console.log("Dependabot alerts data");
    console.log("======================");
    console.log(dependabotAlertsData);

};

run();