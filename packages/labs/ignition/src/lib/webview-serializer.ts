/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {createRequire} from 'node:module';
import {Ignition} from './ignition.js';
import {logChannel} from './logging.js';

const require = createRequire(import.meta.url);
import vscode = require('vscode');

export class WebviewSerializer implements vscode.WebviewPanelSerializer<void> {
  ignition: Ignition;

  constructor(ignition: Ignition) {
    this.ignition = ignition;
  }

  async deserializeWebviewPanel(
    webviewPanel: vscode.WebviewPanel,
    _state: void
  ) {
    logChannel.appendLine(`Restoring webview`);

    const {driveWebviewPanel} = await import('./ignition-webview.js');

    // This will read the state it needs from the Ignition instance
    await driveWebviewPanel(webviewPanel, this.ignition);
  }
}
