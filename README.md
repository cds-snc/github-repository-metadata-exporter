# GitHub repository metadata exporter

This GitHub action collects metadata about a repository and sends it to Azure Sentinel. The following metadata queries are available:

|Query Name|Description|
|----------|-----------|
|queryActionDependencies|Extracts the uses values from workflow files in the .github/workflows directory, which represent the actions used in the workflows.|
|queryBranchProtection|Retrieves information about the branch protection settings for a specified branch in the repository.|
|queryCodeScanningAlerts|Retrieves a list of open code scanning alerts for the repository.|
|queryCommitCount|Retrieves the number of commits in the repository.|
|queryDependabotAlerts|Retrieves a list of open Dependabot alerts for the repository.|
|queryRepository|Retrieves metadata about the repository itself, including the name, description, and creation date.|
|queryRequiredFiles|Retrieves a list of required files in the repository.|
|queryRenovatePRs|Retrieves a list of open pull requests created by Renovate for the repository.|
