package com.payload.parser.sdlc;

/** A problem found in a generated file. Errors block the download unless the user edited the file themselves. */
public record SdlcIssue(Severity severity, String path, String message) {

    public enum Severity { ERROR, WARNING }

    public static SdlcIssue error(String path, String message) {
        return new SdlcIssue(Severity.ERROR, path, message);
    }

    public static SdlcIssue warning(String path, String message) {
        return new SdlcIssue(Severity.WARNING, path, message);
    }
}
