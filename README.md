# GitHub repository metadata exporter

This GitHub action collects metadata about a repository and sends it to Azure Sentinel / Azure Monitor. It also uploads selected datasets to S3.

## Forwarding modes

This action supports two Azure forwarding modes:

- `legacy` (default): Azure Log Analytics shared-key ingestion (existing behavior)
- `dcr`: Azure Data Collection Endpoint / Data Collection Rule ingestion

Backwards compatibility notes:

- The default remains `legacy`.
- Existing legacy configurations continue to work unchanged.
- DCR forwarding is opt-in via `forwarder-mode: dcr`.

## Inputs

### Required in all modes

- `github-app-id`
- `github-app-installation-id`
- `github-app-private-key`
- `s3-bucket`
- `aws-region`

### Azure forwarding mode selector

- `forwarder-mode` (optional, default: `legacy`)

### Legacy mode inputs (`forwarder-mode: legacy`)

- `log-analytics-workspace-id` (required in legacy mode)
- `log-analytics-workspace-key` (required in legacy mode)

### DCR mode inputs (`forwarder-mode: dcr`)

- `azure-dce-endpoint` (required)
- `azure-dcr-immutable-id` (required)
- `azure-dcr-stream-name` (required)
- Authentication, either:
	- `azure-monitor-ingestion-token`, or
	- all of `azure-tenant-id`, `azure-client-id`, `azure-client-secret`

## Usage examples

### Legacy forwarding (default)

```yaml
- name: Export Data
	uses: cds-snc/github-repository-metadata-exporter@main
	with:
		github-app-id: ${{ secrets.SRE_BOT_RO_APP_ID }}
		github-app-installation-id: ${{ secrets.SRE_BOT_RO_INSTALLATION_ID }}
		github-app-private-key: ${{ secrets.SRE_BOT_RO_PRIVATE_KEY }}
		log-analytics-workspace-id: ${{ secrets.LOG_ANALYTICS_WORKSPACE_ID }}
		log-analytics-workspace-key: ${{ secrets.LOG_ANALYTICS_WORKSPACE_KEY }}
		s3-bucket: ${{ secrets.DATA_LAKE_GITHUB_METADATA_EXPORT_S3_BUCKET }}
		aws-region: ${{ secrets.DATA_LAKE_GITHUB_METADATA_EXPORT_AWS_REGION }}
```

### DCR forwarding using a service principal

```yaml
- name: Export Data
	uses: cds-snc/github-repository-metadata-exporter@main
	with:
		github-app-id: ${{ secrets.SRE_BOT_RO_APP_ID }}
		github-app-installation-id: ${{ secrets.SRE_BOT_RO_INSTALLATION_ID }}
		github-app-private-key: ${{ secrets.SRE_BOT_RO_PRIVATE_KEY }}
		forwarder-mode: dcr
		azure-dce-endpoint: ${{ secrets.AZURE_DCE_ENDPOINT }}
		azure-dcr-immutable-id: ${{ secrets.AZURE_DCR_IMMUTABLE_ID }}
		azure-dcr-stream-name: Custom-GitHubMetadata
		azure-tenant-id: ${{ secrets.AZURE_TENANT_ID }}
		azure-client-id: ${{ secrets.AZURE_CLIENT_ID }}
		azure-client-secret: ${{ secrets.AZURE_CLIENT_SECRET }}
		s3-bucket: ${{ secrets.DATA_LAKE_GITHUB_METADATA_EXPORT_S3_BUCKET }}
		aws-region: ${{ secrets.DATA_LAKE_GITHUB_METADATA_EXPORT_AWS_REGION }}
```

### DCR forwarding using a pre-generated ingestion token

```yaml
- name: Export Data
	uses: cds-snc/github-repository-metadata-exporter@main
	with:
		github-app-id: ${{ secrets.SRE_BOT_RO_APP_ID }}
		github-app-installation-id: ${{ secrets.SRE_BOT_RO_INSTALLATION_ID }}
		github-app-private-key: ${{ secrets.SRE_BOT_RO_PRIVATE_KEY }}
		forwarder-mode: dcr
		azure-dce-endpoint: ${{ secrets.AZURE_DCE_ENDPOINT }}
		azure-dcr-immutable-id: ${{ secrets.AZURE_DCR_IMMUTABLE_ID }}
		azure-dcr-stream-name: Custom-GitHubMetadata
		azure-monitor-ingestion-token: ${{ secrets.AZURE_MONITOR_INGESTION_TOKEN }}
		s3-bucket: ${{ secrets.DATA_LAKE_GITHUB_METADATA_EXPORT_S3_BUCKET }}
		aws-region: ${{ secrets.DATA_LAKE_GITHUB_METADATA_EXPORT_AWS_REGION }}
```

## Metadata queries

| Query Name | Description |
| ---------- | ----------- |
| queryActionDependencies | Extracts the uses values from workflow files in the .github/workflows directory, which represent the actions used in the workflows. |
| queryBranchProtection | Retrieves information about the branch protection settings for a specified branch in the repository. |
| queryCodeScanningAlerts | Retrieves a list of open code scanning alerts for the repository. |
| queryCodespaces | Retrieves a list of codespaces for the organisation. |
| queryCommitCount | Retrieves the number of commits in the repository. |
| queryDependabotAlerts | Retrieves a list of open Dependabot alerts for the repository. |
| queryRepository | Retrieves metadata about the repository itself, including the name, description, and creation date. |
| queryRequiredFiles | Retrieves a list of required files in the repository. |
| queryRenovatePRs | Retrieves a list of open pull requests created by Renovate for the repository. |
| queryUsers | Retrieves a list of users for the organisation. |
