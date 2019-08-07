// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { ICellViewModel } from '../interactive-common/cell';
import { extractInputText } from '../interactive-common/mainState';
import { IMainStateControllerProps, MainStateController } from '../interactive-common/mainStateController';
import { getSettings } from '../react-common/settingsReactSide';

export class NativeEditorStateController extends MainStateController {
    // tslint:disable-next-line:max-func-body-length
    constructor(props: IMainStateControllerProps) {
        super(props);
    }

    // tslint:disable-next-line: no-any
    public handleMessage(msg: string, payload?: any) {
        const result = super.handleMessage(msg, payload);

        switch (msg) {
            case InteractiveWindowMessages.LoadAllCells:
                // Stop being busy as we've loaded our first set of cells.
                this.stopBusy();
                break;

            case InteractiveWindowMessages.NotebookDirty:
                // Indicate dirty
                this.setState({ dirty: true });
                break;

            case InteractiveWindowMessages.NotebookClean:
                // Indicate dirty
                this.setState({ dirty: false });
                break;

            default:
                break;
        }

        return result;
    }

    public canMoveUp = (cellId?: string) => {
        const index = this.getState().cellVMs.findIndex(cvm => cvm.cell.id === cellId);
        return (index > 0);
    }

    public canMoveDown = (cellId?: string) => {
        const index = this.getState().cellVMs.findIndex(cvm => cvm.cell.id === cellId);
        return (index < this.getState().cellVMs.length - 1);
    }

    public moveCellUp = (cellId?: string) => {
        const cellVms = this.getState().cellVMs;
        const index = cellVms.findIndex(cvm => cvm.cell.id === cellId);
        if (index > 0) {
            [cellVms[index - 1], cellVms[index]] = [cellVms[index], cellVms[index - 1]];
            this.setState({
                cellVMs: cellVms
            });
        }
    }

    public moveCellDown = (cellId?: string) => {
        const cellVms = this.getState().cellVMs;
        const index = cellVms.findIndex(cvm => cvm.cell.id === cellId);
        if (index < cellVms.length - 1) {
            [cellVms[index + 1], cellVms[index]] = [cellVms[index], cellVms[index + 1]];
            this.setState({
                cellVMs: cellVms
            });
        }
    }

    // Adjust the visibility or collapsed state of a cell
    protected alterCellVM(cellVM: ICellViewModel, _visible: boolean, _expanded: boolean): ICellViewModel {
        // cells are always editable
        cellVM.editable = true;

        // Always have the cell input text open
        const newText = extractInputText(cellVM.cell, getSettings());

        cellVM.inputBlockOpen = true;
        cellVM.inputBlockText = newText;

        return cellVM;
    }

    protected onCodeLostFocus(cellId: string) {
        // Update the cell's source
        const cell = this.findCell(cellId);
        if (cell) {
            // Get the model for the monaco editor
            const monacoId = this.getMonacoId(cellId);
            if (monacoId) {
                const model = monacoEditor.editor.getModels().find(m => m.id === monacoId);
                if (model) {
                    const newValue = model.getValue().replace(/\r/g, '');
                    cell.cell.data.source = newValue;
                }
            }
        }
    }
}
