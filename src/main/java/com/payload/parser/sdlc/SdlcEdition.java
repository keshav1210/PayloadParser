package com.payload.parser.sdlc;

/** How the kit is packaged: unzipped into one project, into a folder holding several services, or as a plugin. */
public enum SdlcEdition {
    PROJECT("claude-sdlc-kit.zip"),
    WORKSPACE("claude-sdlc-workspace.zip"),
    PLUGIN("claude-sdlc-plugin.zip");

    private final String fileName;

    SdlcEdition(String fileName) {
        this.fileName = fileName;
    }

    public String fileName() {
        return fileName;
    }

    public static SdlcEdition of(String format) {
        return switch (format) {
            case "project" -> PROJECT;
            case "workspace" -> WORKSPACE;
            case "plugin" -> PLUGIN;
            default -> throw new SdlcRequestException("format must be project, workspace or plugin.");
        };
    }
}
