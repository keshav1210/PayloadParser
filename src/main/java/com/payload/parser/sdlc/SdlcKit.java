package com.payload.parser.sdlc;

import java.util.List;
import java.util.Map;

/** A generated kit: output path → file content (in output order), plus any problems found while checking it. */
public record SdlcKit(Map<String, String> files, List<SdlcIssue> issues) {

    public boolean hasErrors() {
        return issues.stream().anyMatch(i -> i.severity() == SdlcIssue.Severity.ERROR);
    }
}
