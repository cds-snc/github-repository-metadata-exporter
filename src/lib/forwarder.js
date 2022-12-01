const crypto = require("crypto");
const nodeFetch = require("node-fetch");

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

  let response = await nodeFetch(url, {
    method: method,
    body: body,
    headers: headers,
  });
  return response;
};

module.exports = {
  postData: postData,
};
