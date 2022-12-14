"use strict";

const superagent = require("superagent");

const { normalizeBody, postData } = require("./forwarder.js");

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

describe("normalizeBody", () => {
  test("returns a JSON string", () => {
    const data = {
      id: "123asdf",
      body: "some text data right mere",
      url: "https://www.example.com",
      equation: "2 + 2 = 4",
      comment:
        "<!-- some comment --><a href='https://www.example.com'>link</a>",
    };

    const result = normalizeBody(data);
    expect(result).toEqual(JSON.stringify(data));
  });

  test("removes diacritics", () => {
    const data = {
      diacritics:
        "some data éÉàÀèÈùÙâÂêÊîÎôÔûÛ mixed in for good measure ëËïÏüÜçÇ",
    };

    const result = normalizeBody(data);
    expect(result).toEqual(
      JSON.stringify({
        diacritics:
          "some data eEaAeEuUaAeEiIoOuU mixed in for good measure eEiIuUcC",
      })
    );
  });

  test("removes emojis", () => {
    const data = {
      emoji: "⬆️🙃👍🤖 with text 🦄",
    };

    const result = normalizeBody(data);
    expect(result).toEqual(JSON.stringify({ emoji: " with text " }));
  });
});
