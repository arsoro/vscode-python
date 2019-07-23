// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable, multiInject } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter, Uri, ViewColumn } from 'vscode';

import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    ILiveShareApi,
    IWebPanelProvider,
    IWorkspaceService
} from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, IDisposableRegistry, ILogger } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { IInterpreterService } from '../../interpreter/contracts';
import { captureTelemetry } from '../../telemetry';
import { Identifiers, Settings, Telemetry } from '../constants';
import { InteractiveBase } from '../interactive-common/interactiveBase';
import { InteractiveWindowMessages, ISubmitNewCell } from '../interactive-common/interactiveWindowTypes';
import {
    ICodeCssGenerator,
    IDataViewerProvider,
    IInteractiveWindowListener,
    IJupyterDebugger,
    IJupyterExecution,
    IJupyterVariables,
    INotebookEditor,
    INotebookEditorProvider,
    INotebookExporter,
    INotebookImporter,
    INotebookServerOptions,
    IStatusProvider,
    IThemeFinder
} from '../types';

@injectable()
export class IpynbEditor extends InteractiveBase implements INotebookEditor {
    private closedEvent: EventEmitter<INotebookEditor> = new EventEmitter<INotebookEditor>();
    private _file: Uri = Uri.file('');
    private _serverId = uuid();

    constructor(
        @multiInject(IInteractiveWindowListener) listeners: IInteractiveWindowListener[],
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(IApplicationShell) applicationShell: IApplicationShell,
        @inject(IDocumentManager) documentManager: IDocumentManager,
        @inject(IInterpreterService) interpreterService: IInterpreterService,
        @inject(IWebPanelProvider) provider: IWebPanelProvider,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(ICodeCssGenerator) cssGenerator: ICodeCssGenerator,
        @inject(IThemeFinder) themeFinder: IThemeFinder,
        @inject(ILogger) logger: ILogger,
        @inject(IStatusProvider) statusProvider: IStatusProvider,
        @inject(IJupyterExecution) jupyterExecution: IJupyterExecution,
        @inject(IFileSystem) fileSystem: IFileSystem,
        @inject(IConfigurationService) configuration: IConfigurationService,
        @inject(ICommandManager) commandManager: ICommandManager,
        @inject(INotebookExporter) jupyterExporter: INotebookExporter,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(INotebookEditorProvider) private editorProvider: INotebookEditorProvider,
        @inject(IDataViewerProvider) dataExplorerProvider: IDataViewerProvider,
        @inject(IJupyterVariables) jupyterVariables: IJupyterVariables,
        @inject(IJupyterDebugger) jupyterDebugger: IJupyterDebugger,
        @inject(INotebookImporter) private importer: INotebookImporter
    ) {
        super(
            listeners,
            liveShare,
            applicationShell,
            documentManager,
            interpreterService,
            provider,
            disposables,
            cssGenerator,
            themeFinder,
            logger,
            statusProvider,
            jupyterExecution,
            fileSystem,
            configuration,
            commandManager,
            jupyterExporter,
            workspaceService,
            dataExplorerProvider,
            jupyterVariables,
            jupyterDebugger,
            path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'native-editor', 'index_bundle.js'),
            localize.DataScience.nativeEditorTitle(),
            ViewColumn.Active);

    }

    public get visible(): boolean {
        return this.viewState.visible;
    }

    public get active(): boolean {
        return this.viewState.active;
    }

    public get file(): Uri {
        return this._file;
    }

    public dispose() {
        super.dispose();
        if (this.closedEvent) {
            this.closedEvent.fire(this);
        }
    }

    public async load(content: string, file: Uri): Promise<void> {
        // Save our uri
        this._file = file;

        // Update our title to match
        this.setTitle(path.basename(file.fsPath));

        // Load the contents of this notebook into our cells.
        const cells = await this.importer.importCells(content);

        // If that works, send the cells to the web view
        return this.postMessage(InteractiveWindowMessages.LoadAllCells, { cells });
    }

    public get closed(): Event<INotebookEditor> {
        return this.closedEvent.event;
    }

    @captureTelemetry(Telemetry.SubmitCellThroughInput, undefined, false)
    // tslint:disable-next-line:no-any
    protected submitNewCell(info: ISubmitNewCell) {
        // If there's any payload, it has the code and the id
        if (info && info.code && info.id) {
            // Send to ourselves.
            this.submitCode(info.code, Identifiers.EmptyFileName, 0, info.id, undefined).ignoreErrors();

            // Activate the other side, and send as if came from a file
            this.editorProvider.show(this.file).then(_v => {
                this.shareMessage(InteractiveWindowMessages.RemoteAddCode, { code: info.code, file: Identifiers.EmptyFileName, line: 0, id: info.id, originator: this.id, debug: false });
            }).ignoreErrors();
        }
    }

    protected async getNotebookOptions(): Promise<INotebookServerOptions> {
        const settings = this.configuration.getSettings();
        let serverURI: string | undefined = settings.datascience.jupyterServerURI;
        const useDefaultConfig: boolean | undefined = settings.datascience.useDefaultConfigForJupyter;

        // For the local case pass in our URI as undefined, that way connect doesn't have to check the setting
        if (serverURI === Settings.JupyterServerLocalLaunch) {
            serverURI = undefined;
        }

        return {
            enableDebugging: true,
            uri: serverURI,
            useDefaultConfig,
            purpose: this._serverId  // Each one of these is unique per file.
        };
    }
}