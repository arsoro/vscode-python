# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import os
import shutil
from dataclasses import dataclass
from selenium import webdriver
from .utils import get_binary_location, get_cli_location
from ..bootstrap.main import get_extension_path as get_bootstrap_ext_path
from ..utils.tools import run_command
from ..utils.io import ensure_directory
from .quick_open import QuickOpen
from .quick_input import QuickInput
from .status_bar import StatusBar
from .notifications import Notifications
from .core import Core
from .documents import Documents


@dataclass
class Options:
    executable_dir: str
    user_dir: str
    extensions_dir: str
    extension_path: str
    workspace_folder: str
    temp_folder: str


def get_options(vscode_directory=".vscode-smoke", vsix="ms-python-insiders.vsix"):
    vscode_directory = os.path.abspath(vscode_directory)
    options = Options(
        os.path.join(vscode_directory, "vscode"),
        os.path.join(vscode_directory, "user"),
        os.path.join(vscode_directory, "extensions"),
        os.path.abspath(vsix),
        os.path.join(vscode_directory, "workspace folder"),
        os.path.join(vscode_directory, "temp"),
    )
    ensure_directory(options.extensions_dir)
    ensure_directory(options.user_dir)
    ensure_directory(options.workspace_folder)
    ensure_directory(options.temp_folder)
    return options


def _setup_environment(dirs: Options):
    os.environ["PATH"] += os.pathsep + dirs.executable_dir


def uninstall_extension(options: Options):
    try:
        shutil.rmtree(options.extensions_dir)
    except Exception:
        pass


def install_extension(options: Options):
    uninstall_extension(options)
    env = {"ELECTRON_RUN_AS_NODE": "1"}
    command = [
        get_binary_location(options.executable_dir),
        get_cli_location(options.executable_dir),
        f"--user-data-dir={options.user_dir}",
        f"--extensions-dir={options.extensions_dir}",
        f"--install-extension={options.extension_path}",
    ]
    run_command(command, progress_message="Installing Python Extension", env=env)

    bootstrap_extension = get_bootstrap_ext_path()
    command = [
        get_binary_location(options.executable_dir),
        get_cli_location(options.executable_dir),
        f"--user-data-dir={options.user_dir}",
        f"--extensions-dir={options.extensions_dir}",
        f"--install-extension={bootstrap_extension}",
    ]
    run_command(command, progress_message="Installing Smoke Test Extension", env=env)


def launch_extension(options: Options):
    chrome_options = webdriver.ChromeOptions()
    # Remember to remove the leading `--`.
    # Chromedriver will add `--` for ALL arguments.
    # I.e. arguments without a leading `--` are not supported.
    for arg in [
        f"user-data-dir={options.user_dir}",
        f"extensions-dir={options.extensions_dir}",
        f"folder-uri=file:{options.workspace_folder}",
        "skip-getting-started",
        "skip-release-notes",
        "sticky-quickopen",
        "disable-telemetry",
        "disable-updates",
        "disable-crash-reporter",
    ]:
        chrome_options.add_argument(arg)

    chrome_options.binary_location = get_binary_location(options.executable_dir)
    driver = webdriver.Chrome(options=chrome_options)
    return driver


class Application(object):
    def __init__(self, core: Core):
        self.core = core
        self.quick_open = QuickOpen(self)
        self.quick_input = QuickInput(self)
        self.documents = Documents(self)
        self.status_bar = StatusBar(self)
        self.notifications = Notifications(self)

    @classmethod
    def start(cls, options: Options):
        _setup_environment(options)
        driver = launch_extension(options)
        core = Core(driver)
        app = cls(core)
        return app

    def exit(self):
        try:
            self.quick_open.select_command("Close Window")
        except Exception:
            pass

    def reload(self):
        pass

    def capture_screen(self):
        pass
