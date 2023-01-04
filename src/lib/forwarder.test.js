"use strict";

const superagent = require("superagent");

const { postData, jsonEscapeUTF } = require("./forwarder.js");

jest.mock("superagent");

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
});
