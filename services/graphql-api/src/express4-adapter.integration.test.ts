import { createServer, type Server } from "node:http";
import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("Apollo Server Express 4 adapter", () => {
  const apolloServer = new ApolloServer({
    typeDefs: "type Query { ping: String! }",
    resolvers: {
      Query: {
        ping: () => "pong",
      },
    },
  });
  let httpServer: Server | undefined;
  let endpoint: string;

  beforeAll(async () => {
    await apolloServer.start();
    const app = express();
    app.use(express.json(), expressMiddleware(apolloServer));

    const server = createServer(app);
    httpServer = server;
    await new Promise<void>((resolve) => server.listen(0, resolve));

    const address = httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected the HTTP server to listen on a TCP port");
    }
    endpoint = `http://127.0.0.1:${address.port}/`;
  });

  afterAll(async () => {
    const server = httpServer;
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await apolloServer.stop();
  });

  it("serves a GraphQL query through Express 4", async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "{ ping }" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { ping: "pong" },
    });
  });
});
