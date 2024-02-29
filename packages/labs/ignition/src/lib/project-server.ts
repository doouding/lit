/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {Server} from 'net';
import {createRequire} from 'module';
import type {AddressInfo} from 'net';
import {getAnalyzer} from './analyzer.js';
import {Deferred} from './deferred.js';
import {getUiServer} from './ui-server.js';
import cors from 'koa-cors';
import Koa from 'koa';
import type {AbsolutePath, Analyzer, PackagePath} from '@lit-labs/analyzer';
import Router from '@koa/router';
import * as wds from '@web/dev-server';
import type {Plugin} from '@web/dev-server-core';

const require = createRequire(import.meta.url);
import vscode = require('vscode');
import {getModulePathFromJsPath} from './paths.js';
import {addSourceIds} from './source-id-transform.js';

// TODO (justinfagnani): /_src/ isn't a great name. Right now it's just a
// prefix for all JS files. We're not requesting source from the server, but
// built files.
const baseUrl = '/_src/';

const startServer = async (
  uiServerPort: number,
  workspaceFolder: vscode.WorkspaceFolder,
  analyzer: Analyzer
) => {
  const rootDir = analyzer.getPackage().rootDir;
  const lazyAddress: LazyAddress = {port: 0};

  const fileCache = new Map<string, string>();

  const passThroughPlugin: Plugin = {
    name: 'pass-through',
    serve(context) {
      const jsPath = context.path as PackagePath;
      if (jsPath.startsWith('/node_modules/')) {
        // TODO: exclude WDS path prefixes
        return;
      }
      const filePath = (workspaceFolder.uri.fsPath + jsPath) as AbsolutePath;

      // First, check the cache
      let result = fileCache.get(filePath);
      if (result !== undefined) {
        return result;
      }

      // Find the SourceFile
      const modulePath = getModulePathFromJsPath(analyzer, filePath);
      if (modulePath === undefined) {
        // File is not in TS project, so let WDS try to serve it
        return;
      }
      const sourceFile = analyzer.program.getSourceFile(modulePath);
      if (sourceFile === undefined) {
        // Shouldn't be possible?
        return;
      }

      // Emit
      let emitted = false;
      analyzer.program.emit(
        sourceFile,
        (
          fileName: string,
          text: string,
          _writeByteOrderMark: boolean,
          _onError?: (message: string) => void
        ) => {
          if (fileName === filePath) {
            emitted = true;
            result = text;
          }
        },
        undefined,
        undefined,
        {
          after: [
            addSourceIds(
              analyzer.typescript,
              analyzer.program.getTypeChecker()
            ),
          ],
        }
      );

      if (emitted) {
        fileCache.set(filePath, result!);
        return result;
      }
      // Unknown problem with emit?
    },
  };

  const devServer = await wds.startDevServer({
    config: {
      rootDir,
      plugins: [passThroughPlugin],
      middleware: [
        cors({origin: '*', credentials: true}),
        ...getMiddleware(uiServerPort, analyzer, lazyAddress),
      ],
      nodeResolve: true,
    },
    readCliArgs: false,
    readFileConfig: false,
  });
  const address = devServer.server?.address();
  const port = typeof address === 'string' ? address : address?.port;
  lazyAddress.port = port!;
  return devServer.server!;
};

// This will have the port by the time it's accessed.
interface LazyAddress {
  port: string | number;
}

const getMiddleware = (
  uiServerPort: number,
  analyzer: Analyzer,
  lazyAddress: LazyAddress
): Koa.Middleware<unknown, any, unknown>[] => {
  const router = new Router();

  router.get('/story/:path', async (context, next) => {
    const path = context.params.path;
    // Split pathAndName into a story file path and story name
    // const [storyPath, storyName] = pathAndName.split(':');
    const storyPath = path;
    const storySrc = `http://localhost:${lazyAddress.port}/${storyPath}`;

    context.body = /* html */ `
      <!doctype html>
      <html>
        <head>
          <script type='module' src='http://localhost:${uiServerPort}/frame-entrypoint.js'></script>
          <style id="_defaultStyles"></style>
          <style>
            body, html {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
            }
            * {
              box-sizing: border-box;
            }
          </style>
        </head>
        <body>
          <ignition-storyboard src=${storySrc}></ignition-storyboard>
        </body>
      </html>
    `;
  });
  return [router.routes(), router.allowedMethods()];
};

const serverCache = new Map<string, Deferred<Server>>();

export const getProjectServer = async (
  workspaceFolder: vscode.WorkspaceFolder
) => {
  let serverDeferred = serverCache.get(workspaceFolder.uri.fsPath);
  if (serverDeferred === undefined) {
    serverDeferred = new Deferred<Server>();
    // Must be before first await to avoid races
    serverCache.set(workspaceFolder.uri.fsPath, serverDeferred);

    try {
      // Even though getWorkspaceAnalyzer() is synchronous, using Promise.all()
      // lets it run while the server is starting.
      const [uiServer, analyzer] = await Promise.all([
        getUiServer(),
        getAnalyzer(workspaceFolder),
      ]);

      const uiServerAddress = uiServer.server?.address() as AddressInfo;

      const server = await startServer(
        uiServerAddress.port,
        workspaceFolder,
        analyzer
      );
      serverDeferred.resolve(server);
    } catch (e) {
      serverDeferred.reject(e as Error);
    }
  }
  return serverDeferred.promise;
};
