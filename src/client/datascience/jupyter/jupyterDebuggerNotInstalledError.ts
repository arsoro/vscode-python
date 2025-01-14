// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';
import * as localize from '../../common/utils/localize';

export class JupyterDebuggerNotInstalledError extends Error {
    constructor() {
        super(localize.DataScience.jupyterDebuggerNotInstalledError());
    }
}
