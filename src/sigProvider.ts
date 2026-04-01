import vscode from "vscode";

import { resolveExePathAndVersion, workspaceConfigUpdateNoThrow } from "./zigUtil";

interface ExeWithVersion {
    exe: string;
    version: string;
}

/**
 * Provides the path to the `sig` executable.
 * Sig is a capacity-first memory model layer on top of the Zig compiler.
 */
export class SigProvider {
    onChange: vscode.EventEmitter<ExeWithVersion | null> = new vscode.EventEmitter();
    private value: ExeWithVersion | null;

    constructor() {
        this.value = this.resolveSigPathConfigOption() ?? null;
    }

    /** Returns the path to the Sig executable that is currently being used. */
    public getSigPath(): string | null {
        return this.value?.exe ?? null;
    }

    /** Set the path to the Sig executable. */
    public set(value: ExeWithVersion | null) {
        if (value === null && this.value === null) return;
        this.value = value;
        this.onChange.fire(value);
    }

    /**
     * Set the path to the Sig executable. Will be saved in `sig.path` config option.
     */
    public async setAndSave(sigPath: string | null) {
        const sigConfig = vscode.workspace.getConfiguration("sig");
        if (!sigPath) {
            await workspaceConfigUpdateNoThrow(sigConfig, "path", undefined, true);
            return;
        }
        const newValue = this.resolveSigPathConfigOption(sigPath);
        if (!newValue) return;
        await workspaceConfigUpdateNoThrow(sigConfig, "path", newValue.exe, true);
        this.set(newValue);
    }

    /** Resolves the `sig.path` configuration option. */
    public resolveSigPathConfigOption(sigPath?: string): ExeWithVersion | null | undefined {
        sigPath ??= vscode.workspace.getConfiguration("sig").get<string>("path", "");
        if (!sigPath) {
            // Try to find sig in PATH silently
            const result = resolveExePathAndVersion("sig", "version");
            if ("exe" in result) {
                return { exe: result.exe, version: result.version.toString() };
            }
            return null;
        }
        const result = resolveExePathAndVersion(sigPath, "version");
        if ("message" in result) {
            // Don't show error for sig — it's optional, just return null
            return null;
        }
        return { exe: result.exe, version: result.version.toString() };
    }
}
