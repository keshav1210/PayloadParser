package com.payload.parser.sdlc;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Checks a generated kit against Claude Code's file formats and limits before it can be downloaded. */
public final class SdlcValidator {

    static final Set<String> BUILT_IN_COMMANDS = Set.of(
            "help", "init", "review", "status", "config", "clear", "compact", "doctor", "memory", "model", "cost",
            "login", "logout", "agents", "hooks", "mcp", "permissions", "plugin", "resume", "security-review",
            "skills", "context", "export", "add-dir", "bug", "terminal-setup", "vim", "ide", "release-notes",
            "code-review", "ultrareview", "pr-comments", "upgrade", "usage", "rewind", "statusline",
            "output-style", "todos", "feedback");
    private static final Set<String> BUILT_IN_AGENTS = Set.of("Explore", "Plan", "general-purpose");
    private static final Set<String> USER_CREATED = Set.of(
            ".claude/settings.local.json", "CLAUDE.local.md", ".claude/agent-memory/");

    private static final Pattern SKILL = Pattern.compile("^\\.claude/skills/([^/]+)/SKILL\\.md$");
    private static final Pattern AGENT = Pattern.compile("^\\.claude/agents/([^/]+)\\.md$");
    private static final Pattern PATH_REF = Pattern.compile("`((?:\\.claude|docs)/[^`\\s*<>]+?)`");
    private static final Pattern IMPORT = Pattern.compile("^@(\\S+)");
    private static final Pattern OPTIONAL_LINE = Pattern.compile("\\b(if|when)\\b[^.]*\\bexists?\\b", Pattern.CASE_INSENSITIVE);
    private static final int MAX_DESCRIPTION = 1536;

    private SdlcValidator() {
    }

    public static List<SdlcIssue> validate(Map<String, String> files, Set<String> userEdited, String claudeFile) {
        List<SdlcIssue> issues = new ArrayList<>();
        for (Map.Entry<String, String> e : files.entrySet()) {
            String path = e.getKey();
            String text = e.getValue();
            List<SdlcIssue> found = new ArrayList<>();
            checkFile(path, text, files, found);
            if (userEdited.contains(path)) {
                found.replaceAll(i -> SdlcIssue.warning(i.path(), i.message() + " (in your edit)"));
            }
            issues.addAll(found);
        }
        String claude = files.get(claudeFile);
        if (claude == null) {
            issues.add(SdlcIssue.error(claudeFile, "missing"));
        } else if (lines(claude) > 200) {
            issues.add(SdlcIssue.warning(claudeFile, lines(claude) + " lines; Claude Code recommends under 200"));
        }
        return issues;
    }

    private static void checkFile(String path, String text, Map<String, String> files, List<SdlcIssue> issues) {
        if (text.contains("{{") || text.contains("}}")) issues.add(SdlcIssue.error(path, "unresolved template placeholder"));

        Matcher skill = SKILL.matcher(path);
        if (skill.matches()) {
            Map<String, Object> fm = frontmatter(path, text, issues);
            if (fm != null) {
                String folder = skill.group(1);
                Object name = fm.get("name");
                if (name != null && !folder.equals(name.toString())) {
                    issues.add(SdlcIssue.error(path, "name \"" + name + "\" doesn't match folder \"" + folder + "\""));
                }
                String description = str(fm.get("description")) + str(fm.get("when_to_use"));
                if (description.isBlank()) issues.add(SdlcIssue.error(path, "no description"));
                if (description.length() > MAX_DESCRIPTION) {
                    issues.add(SdlcIssue.error(path, "description is " + description.length() + " characters; the limit is " + MAX_DESCRIPTION));
                }
                if (BUILT_IN_COMMANDS.contains(folder)) issues.add(SdlcIssue.error(path, "/" + folder + " clashes with a built-in command"));
                Object agent = fm.get("agent");
                if (agent != null && !BUILT_IN_AGENTS.contains(agent.toString())
                        && !files.containsKey(".claude/agents/" + agent + ".md")) {
                    issues.add(SdlcIssue.error(path, "uses agent \"" + agent + "\", which isn't in the kit"));
                }
            }
            if (lines(text) > 500) issues.add(SdlcIssue.warning(path, lines(text) + " lines; keep skills under 500"));
        }

        Matcher agent = AGENT.matcher(path);
        if (agent.matches()) {
            Map<String, Object> fm = frontmatter(path, text, issues);
            if (fm != null && (fm.get("name") == null || fm.get("description") == null)) {
                issues.add(SdlcIssue.error(path, "agents need a name and a description"));
            }
        }

        if (path.startsWith(".claude/rules/") && text.startsWith("---\n")) frontmatter(path, text, issues);

        if (path.endsWith(".json")) {
            try {
                new ObjectMapper().readTree(text);
            } catch (Exception ex) {
                issues.add(SdlcIssue.error(path, "invalid JSON"));
            }
        }

        if (path.endsWith(".md")) checkReferences(path, text, files, issues);
    }

    private static void checkReferences(String path, String text, Map<String, String> files, List<SdlcIssue> issues) {
        Set<String> refs = new LinkedHashSet<>();
        for (String line : text.split("\n")) {
            if (!OPTIONAL_LINE.matcher(line).find()) {
                Matcher m = PATH_REF.matcher(line);
                while (m.find()) refs.add(m.group(1));
            }
            Matcher imp = IMPORT.matcher(line);
            if (imp.find()) refs.add(imp.group(1));
        }
        for (String ref : refs) {
            String clean = ref.replaceAll("[),.;:]+$", "");
            if (clean.contains("YYYY") || clean.contains("<") || clean.contains("*") || USER_CREATED.contains(clean)) continue;
            boolean exists = clean.endsWith("/")
                    ? files.keySet().stream().anyMatch(k -> k.startsWith(clean))
                    : files.containsKey(clean);
            if (!exists) issues.add(SdlcIssue.error(path, "refers to " + clean + ", which isn't in the kit"));
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> frontmatter(String path, String text, List<SdlcIssue> issues) {
        if (!text.startsWith("---\n")) {
            issues.add(SdlcIssue.error(path, "must start with YAML frontmatter (---)"));
            return null;
        }
        int end = text.indexOf("\n---", 4);
        if (end < 0) {
            issues.add(SdlcIssue.error(path, "frontmatter isn't closed with ---"));
            return null;
        }
        try {
            Object parsed = new Yaml(new SafeConstructor(new LoaderOptions())).load(text.substring(4, end));
            if (parsed == null) return Map.of();
            if (parsed instanceof Map<?, ?> map) return (Map<String, Object>) map;
            issues.add(SdlcIssue.error(path, "frontmatter isn't a set of key: value lines"));
        } catch (Exception ex) {
            issues.add(SdlcIssue.error(path, "invalid YAML frontmatter (Claude Code would ignore this file)"));
        }
        return null;
    }

    private static String str(Object o) {
        return o == null ? "" : o.toString();
    }

    private static int lines(String text) {
        return text.split("\n", -1).length;
    }
}
