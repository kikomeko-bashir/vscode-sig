import vscode from "vscode";

import { ZIG_SIG_FILE_MODE, isZigOrSigLanguage } from "./zigUtil";
import { activate as activateZls, deactivate as deactivateZls } from "./zls";
import { registerBuildOnSaveProvider } from "./zigBuildOnSaveProvider";
import { registerDiagnosticsProvider } from "./zigDiagnosticsProvider";
import { registerDocumentFormatting } from "./zigFormat";
import { registerTerminalStateManagement } from "./terminalState";
import { setupZig } from "./zigSetup";

import ZigMainCodeLensProvider from "./zigMainCodeLens";
import ZigTestRunnerProvider from "./zigTestRunnerProvider";

export async function activate(context: vscode.ExtensionContext) {
    await setupZig(context).finally(() => {
        context.subscriptions.push(registerDiagnosticsProvider());
        context.subscriptions.push(registerBuildOnSaveProvider());
        context.subscriptions.push(registerDocumentFormatting());

        const testRunner = new ZigTestRunnerProvider();
        testRunner.activate(context.subscriptions);

        registerTerminalStateManagement();
        ZigMainCodeLensProvider.registerCommands(context);
        context.subscriptions.push(
            vscode.languages.registerCodeLensProvider(ZIG_SIG_FILE_MODE, new ZigMainCodeLensProvider()),
            vscode.commands.registerCommand("zig.toggleMultilineStringLiteral", toggleMultilineStringLiteral),
        );

        void activateZls(context);
    });
}

export async function deactivate() {
    await deactivateZls();
}

async function toggleMultilineStringLiteral() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const { document, selection } = editor;
    if (!isZigOrSigLanguage(document.languageId)) return;

    let newText = "";
    let range = new vscode.Range(selection.start, selection.end);

    const firstLine = document.lineAt(selection.start.line);
    const nonWhitespaceIndex = firstLine.firstNonWhitespaceCharacterIndex;

    for (let lineNum = selection.start.line; lineNum <= selection.end.line; lineNum++) {
        const line = document.lineAt(lineNum);

        const isMLSL = line.text.slice(line.firstNonWhitespaceCharacterIndex).startsWith("\\\\");
        const breakpoint = Math.min(nonWhitespaceIndex, line.firstNonWhitespaceCharacterIndex);

        const newLine = isMLSL
            ? line.text.slice(0, line.firstNonWhitespaceCharacterIndex) +
              line.text.slice(line.firstNonWhitespaceCharacterIndex).slice(2)
            : line.isEmptyOrWhitespace
              ? " ".repeat(nonWhitespaceIndex) + "\\\\"
              : line.text.slice(0, breakpoint) + "\\\\" + line.text.slice(breakpoint);
        newText += newLine;
        if (lineNum < selection.end.line) newText += "\n";

        range = range.union(line.range);
    }

    await editor.edit((builder) => {
        builder.replace(range, newText);
    });
}
