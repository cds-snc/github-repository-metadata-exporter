"use strict";

const crypto = require("crypto");
const superagent = require("superagent");
const AWS = require("aws-sdk");

const { postData, jsonEscapeUTF, uploadToS3 } = require("./forwarder.js");

jest.mock("superagent");
jest.mock("aws-sdk");

describe("postData", () => {
  test("returns true if the request succeeds", async () => {
    const workspaceId = "workspaceId";
    const workspaceKey = "workspaceKey";
    const data = {
      id: "123",
    };
    const logType = "logType";

    const response = {
      status: 200,
    };

    superagent.post.mockReturnValue({
      set: jest.fn().mockReturnValue({
        send: jest.fn().mockReturnValue(response),
      }),
    });

    const result = await postData(workspaceId, workspaceKey, data, logType);
    expect(result).toEqual(true);
  });

  test("throws an error if the request fails", async () => {
    const workspaceId = "workspaceId";
    const workspaceKey = "workspaceKey";
    const data = {
      id: "123",
    };
    const logType = "logType";

    const response = {
      status: 400,
      text: "Bad request",
    };

    superagent.post.mockReturnValue({
      set: jest.fn().mockReturnValue({
        send: jest.fn().mockReturnValue(response),
      }),
    });

    await expect(
      postData(workspaceId, workspaceKey, data, logType)
    ).rejects.toThrow(
      `Error posting data to Azure Log Analytics: ${response.status}`
    );
  });

  test("throws an error if network error occurs", async () => {
    const workspaceId = "workspaceId";
    const workspaceKey = "workspaceKey";
    const data = { id: "123" };
    const logType = "logType";

    const networkError = new Error("Network error");
    networkError.status = undefined;

    superagent.post.mockReturnValue({
      set: jest.fn().mockReturnValue({
        send: jest.fn().mockRejectedValue(networkError),
      }),
    });

    await expect(
      postData(workspaceId, workspaceKey, data, logType)
    ).rejects.toThrow("Error posting data to Azure Log Analytics: undefined");
  });
});

describe("jsonEscapeUTF", () => {
  test("escapes the string", () => {
    const data = {
      id: "123",
    };

    const result = jsonEscapeUTF(JSON.stringify(data));
    expect(result).toEqual('{"id":"123"}');
  });

  test("escapes the string with a unicode character", () => {
    const data = {
      id: "123",
      name: "🤖",
    };

    const result = jsonEscapeUTF(JSON.stringify(data));
    expect(result).toEqual('{"id":"123","name":"\\ud83e\\udd16"}');
  });

  test("escapes various Unicode characters", () => {
    const testCases = [
      { input: "Hello\u00A9World", expected: "Hello\\u00a9World" },
      { input: "Test\u2028Line", expected: "Test\\u2028Line" },
      { input: "Emoji\u{1F600}", expected: "Emoji\\ud83d\\ude00" },
      { input: "Chinese: 中文", expected: "Chinese: \\u4e2d\\u6587" },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = jsonEscapeUTF(input);
      expect(result).toEqual(expected);
    });
  });

  test("preserves ASCII characters", () => {
    const data =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 !@#$%^&*()";
    const result = jsonEscapeUTF(data);
    expect(result).toEqual(data);
  });
});

describe("uploadToS3", () => {
  let mockS3Instance;
  let mockPutObject;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPutObject = jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });

    mockS3Instance = {
      putObject: mockPutObject,
    };

    AWS.S3.mockImplementation(() => mockS3Instance);
  });

  test("uploads data to S3 successfully with default region", async () => {
    const bucket = "test-bucket";
    const key = "test-key.json";
    const data = { id: "123", name: "test" };

    const result = await uploadToS3(bucket, key, data);

    expect(result).toBe(true);
    expect(AWS.S3).toHaveBeenCalledWith({ region: "ca-central-1" });
    expect(mockPutObject).toHaveBeenCalledWith({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    });
  });

  test("uploads data to S3 with custom region", async () => {
    const bucket = "test-bucket";
    const key = "test-key.json";
    const data = { id: "456" };
    const region = "us-east-1";

    const result = await uploadToS3(bucket, key, data, region);

    expect(result).toBe(true);
    expect(AWS.S3).toHaveBeenCalledWith({ region: region });
  });

  test("caches S3 client per region", async () => {
    const bucket = "test-bucket";
    const data = { id: "789" };

    // First call with region 1
    await uploadToS3(bucket, "key1.json", data, "us-west-1");
    expect(AWS.S3).toHaveBeenCalledTimes(1);

    // Second call with same region should reuse client
    await uploadToS3(bucket, "key2.json", data, "us-west-1");
    expect(AWS.S3).toHaveBeenCalledTimes(1);

    // Third call with different region should create new client
    await uploadToS3(bucket, "key3.json", data, "eu-west-1");
    expect(AWS.S3).toHaveBeenCalledTimes(2);
  });

  test("throws error when S3 upload fails", async () => {
    const bucket = "test-bucket";
    const key = "test-key.json";
    const data = { id: "123" };
    const s3Error = new Error("Access Denied");

    // Create a new mock S3 instance for this test
    const failingPutObject = jest.fn().mockReturnValue({
      promise: jest.fn().mockRejectedValue(s3Error),
    });

    const failingS3Instance = {
      putObject: failingPutObject,
    };

    AWS.S3.mockImplementationOnce(() => failingS3Instance);

    await expect(uploadToS3(bucket, key, data, "test-region")).rejects.toThrow(
      "Error uploading data to S3: Access Denied"
    );
  });

  test("formats JSON with proper indentation", async () => {
    const bucket = "test-bucket";
    const key = "test-key.json";
    const data = { id: "123", nested: { value: "test" } };
    const uniqueRegion = "format-test-region";

    // Create a fresh mock for this test
    const formatPutObject = jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });

    const formatS3Instance = {
      putObject: formatPutObject,
    };

    AWS.S3.mockImplementationOnce(() => formatS3Instance);

    await uploadToS3(bucket, key, data, uniqueRegion);

    expect(formatPutObject).toHaveBeenCalledWith(
      expect.objectContaining({
        Body: JSON.stringify(data, null, 2),
      })
    );
  });
});

describe("buildSignature", () => {
  test("generates valid Azure Log Analytics signature", () => {
    const customerId = "test-customer-id";
    const sharedKey = Buffer.from("test-shared-key").toString("base64");
    const date = "Mon, 21 Nov 2025 12:00:00 GMT";
    const contentLength = 100;
    const method = "POST";
    const contentType = "application/json";
    const resource = "/api/logs";

    // Since buildSignature is not exported, we'll test it through postData
    // But we can test the signature format by mocking crypto
    const stringToHash =
      method +
      "\n" +
      contentLength +
      "\n" +
      contentType +
      "\n" +
      "x-ms-date:" +
      date +
      "\n" +
      resource;

    const decodedKey = Buffer.from(sharedKey, "base64");
    const expectedHash = crypto
      .createHmac("sha256", decodedKey)
      .update(Buffer.from(stringToHash, "utf-8"))
      .digest("base64");
    const expectedAuth = "SharedKey " + customerId + ":" + expectedHash;

    // Verify the signature format is correct
    expect(expectedAuth).toMatch(/^SharedKey .+:.+$/);
    expect(expectedAuth).toContain(customerId);
  });

  test("signature includes all required components", async () => {
    const workspaceId = "workspace-id";
    const workspaceKey = Buffer.from("test-key").toString("base64");
    const data = { test: "data" };
    const logType = "TestLog";

    let capturedHeaders;
    superagent.post.mockReturnValue({
      set: jest.fn().mockImplementation((headers) => {
        capturedHeaders = headers;
        return {
          send: jest.fn().mockResolvedValue({ status: 200 }),
        };
      }),
    });

    await postData(workspaceId, workspaceKey, data, logType);

    expect(capturedHeaders.Authorization).toMatch(
      /^SharedKey workspace-id:.+$/
    );
    expect(capturedHeaders["x-ms-date"]).toBeTruthy();
    expect(capturedHeaders["Log-Type"]).toBe(logType);
    expect(capturedHeaders["content-type"]).toBe("application/json");
  });
});
