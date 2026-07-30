const crypto = require("crypto");
const superagent = require("superagent");
const AWS = require("aws-sdk");

const dcrApiVersion = "2023-01-01";
const azureMonitorScope = "https://monitor.azure.com/.default";

const buildSignature = (
  customerId,
  sharedKey,
  date,
  contentLength,
  method,
  contentType,
  resource
) => {
  let xHeaders = "x-ms-date:" + date;
  let stringToHash =
    method +
    "\n" +
    contentLength +
    "\n" +
    contentType +
    "\n" +
    xHeaders +
    "\n" +
    resource;

  let bytes = Buffer.from(stringToHash, "utf-8");
  let decodedKey = Buffer.from(sharedKey, "base64");
  let encodedHash = crypto
    .createHmac("sha256", decodedKey)
    .update(bytes)
    .digest("base64");
  let authorization = "SharedKey " + customerId + ":" + encodedHash;
  return authorization;
};

const postData = async (customerId, sharedKey, body, logType) => {
  body = jsonEscapeUTF(JSON.stringify(body));
  let method = "POST";
  let contentType = "application/json";
  let resource = "/api/logs";
  let rfc1123date = new Date().toUTCString();
  let contentLength = body.length;

  let signature = buildSignature(
    customerId,
    sharedKey,
    rfc1123date,
    contentLength,
    method,
    contentType,
    resource
  );

  let url = `https://${customerId}.ods.opinsights.azure.com${resource}?api-version=2016-04-01`;
  let headers = {
    "content-type": contentType,
    Authorization: signature,
    "Log-Type": logType,
    "x-ms-date": rfc1123date,
  };

  try {
    let response = await superagent.post(url).set(headers).send(body);
    if (response.status !== 200) {
      throw response;
    }
  } catch (error) {
    throw new Error(
      `Error posting data to Azure Log Analytics: ${error.status}`
    );
  }
  return true;
};

const normalizeDceEndpoint = (endpoint) => endpoint.replace(/\/+$/, "");

const buildDcrIngestionUrl = (endpoint, dcrImmutableId, streamName) => {
  const normalizedEndpoint = normalizeDceEndpoint(endpoint);
  return `${normalizedEndpoint}/dataCollectionRules/${dcrImmutableId}/streams/${streamName}?api-version=${dcrApiVersion}`;
};

const getDcrIngestionToken = async ({
  azureMonitorIngestionToken,
  azureTenantId,
  azureClientId,
  azureClientSecret,
}) => {
  if (azureMonitorIngestionToken) {
    return azureMonitorIngestionToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${azureTenantId}/oauth2/v2.0/token`;
  try {
    const response = await superagent.post(tokenUrl).type("form").send({
      client_id: azureClientId,
      client_secret: azureClientSecret,
      scope: azureMonitorScope,
      grant_type: "client_credentials",
    });

    if (!response.body || !response.body.access_token) {
      throw new Error("Missing access_token in Azure AD response");
    }

    return response.body.access_token;
  } catch (error) {
    throw new Error(
      `Error retrieving Azure Monitor ingestion token: ${error.status}`
    );
  }
};

const postDataDcr = async (config, body) => {
  const {
    azureDceEndpoint,
    azureDcrImmutableId,
    azureDcrStreamName,
    azureMonitorIngestionToken,
    azureTenantId,
    azureClientId,
    azureClientSecret,
  } = config;

  const ingestionToken = await getDcrIngestionToken({
    azureMonitorIngestionToken,
    azureTenantId,
    azureClientId,
    azureClientSecret,
  });

  const url = buildDcrIngestionUrl(
    azureDceEndpoint,
    azureDcrImmutableId,
    azureDcrStreamName
  );

  const payload = Array.isArray(body) ? body : [body];

  try {
    const response = await superagent
      .post(url)
      .set({
        "content-type": "application/json",
        Authorization: `Bearer ${ingestionToken}`,
      })
      .send(payload);

    if (response.status < 200 || response.status >= 300) {
      throw response;
    }
  } catch (error) {
    throw new Error(
      `Error posting data to Azure Monitor DCE/DCR: ${error.status}`
    );
  }

  return true;
};

function jsonEscapeUTF(s) {
  return s.replace(
    /[^\x20-\x7F]/g,
    (x) => "\\u" + ("000" + x.codePointAt(0).toString(16)).slice(-4)
  );
}

// Module-level cache for S3 clients per region
const s3Clients = {};
async function uploadToS3(bucket, key, data, awsRegion = "ca-central-1") {
  if (!s3Clients[awsRegion]) {
    s3Clients[awsRegion] = new AWS.S3({ region: awsRegion });
  }
  const s3 = s3Clients[awsRegion];
  const params = {
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json",
  };
  try {
    await s3.putObject(params).promise();
    return true;
  } catch (err) {
    throw new Error(`Error uploading data to S3: ${err.message}`);
  }
}

module.exports = {
  jsonEscapeUTF: jsonEscapeUTF,
  postData: postData,
  postDataDcr: postDataDcr,
  uploadToS3: uploadToS3,
};
