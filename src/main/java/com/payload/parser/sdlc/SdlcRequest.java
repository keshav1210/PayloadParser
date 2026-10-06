package com.payload.parser.sdlc;

import java.util.List;
import java.util.Map;

public record SdlcRequest(
        String projectName,
        String projectDescription,
        String projectStack,
        boolean developer,
        boolean tester,
        List<String> profiles,
        List<String> testFrameworks,
        List<String> extras,
        List<FolderNote> folders,
        String commandPrefix,
        boolean existingClaudeMd,
        String lintCommand,
        String hookShell,
        Map<String, String> edits,
        List<Service> services) {

    public record FolderNote(String path, String note) {
    }

    /** A service in a multi-service workspace: its folder, and optionally its purpose, stack and git URL. */
    public record Service(String folder, String purpose, String stack, String repo) {
    }

    public SdlcRequest(String projectName, String projectDescription, String projectStack, boolean developer,
                       boolean tester, List<String> profiles, List<String> testFrameworks, List<String> extras,
                       List<FolderNote> folders, String commandPrefix, boolean existingClaudeMd, String lintCommand,
                       String hookShell, Map<String, String> edits) {
        this(projectName, projectDescription, projectStack, developer, tester, profiles, testFrameworks, extras,
                folders, commandPrefix, existingClaudeMd, lintCommand, hookShell, edits, null);
    }

    public List<String> profilesOrEmpty() {
        return profiles == null ? List.of() : profiles;
    }

    public List<String> testFrameworksOrEmpty() {
        return testFrameworks == null ? List.of() : testFrameworks;
    }

    public List<String> extrasOrEmpty() {
        return extras == null ? List.of() : extras;
    }

    public List<FolderNote> foldersOrEmpty() {
        return folders == null ? List.of() : folders;
    }

    public Map<String, String> editsOrEmpty() {
        return edits == null ? Map.of() : edits;
    }

    public List<Service> servicesOrEmpty() {
        return services == null ? List.of() : services;
    }
}
