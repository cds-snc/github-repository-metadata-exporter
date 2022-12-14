const crypto = require("crypto");
const superagent = require("superagent");

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
  body = normalizeBody(body);

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

/**
 * Remove all diacritics and emojis from the payload body.
 * This is to ensure that the data is sent to Azure Log Analytics without any issues.
 * @param {String} body content to noralize
 * @returns {String}
 */
const normalizeBody = (body) => {
  return JSON.stringify(body)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(
      /(?![*#0-9]+)[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}]/gu,
      ""
    );
};

module.exports = {
  normalizeBody: normalizeBody,
  postData: postData,
};
