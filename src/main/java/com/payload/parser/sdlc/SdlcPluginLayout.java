package com.payload.parser.sdlc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns a project-layout kit into a Claude Code plugin. Plugins can ship skills, agents and hooks, but not
 * CLAUDE.md, rules or permissions, so those go to {@code templates/} and the plugin's setup skill copies them
 * into each project.
 */
public final class SdlcPluginLayout {

    public static final String NAME = "sdlc-kit";

    private static final Pattern SKILL = Pattern.compile("^\\.claude/skills/([^/]+)/(.+)$");
    private static final Pattern AGENT = Pattern.compile("^\\.claude/agents/([^/]+)\\.md$");
    private static final Pattern PLUGIN_SKILL_REF = Pattern.compile("\\$\\{CLAUDE_PLUGIN_ROOT}/skills/([^/`\\s]+)/");
    private static final Pattern AGENT_FIELD = Pattern.compile("(?m)^agent: (\\S+)$");

    private SdlcPluginLayout() {
    }

    public static Map<String, String> convert(Map<String, String> project, String version, ObjectMapper mapper) {
        Set<String> skills = new TreeSet<>(Comparator.comparing(String::length).reversed().thenComparing(s -> s));
        Set<String> agents = new TreeSet<>(Comparator.comparing(String::length).reversed().thenComparing(s -> s));
        for (String path : project.keySet()) {
            Matcher s = SKILL.matcher(path);
            if (s.matches()) skills.add(s.group(1));
            Matcher a = AGENT.matcher(path);
            if (a.matches()) agents.add(a.group(1));
        }

        Map<String, String> out = new TreeMap<>();
        for (Map.Entry<String, String> e : project.entrySet()) {
            String path = e.getKey();
            String text = rewrite(e.getValue(), skills, agents);
            Matcher s = SKILL.matcher(path);
            Matcher a = AGENT.matcher(path);
            if (s.matches()) {
                out.put("skills/" + s.group(1) + "/" + s.group(2), text);
            } else if (a.matches()) {
                out.put("agents/" + a.group(1) + ".md", text.replaceAll("(?m)^permissionMode: .*\\n", ""));
            } else if (path.equals("README.md")) {
                out.put(path, text);
            } else if (path.equals(".claude/settings.json")) {
                splitSettings(text, out, mapper);
            } else {
                out.put("templates/" + path, text);
            }
        }

        ObjectNode manifest = mapper.createObjectNode()
                .put("name", NAME)
                .put("description", "SDLC kit for Claude Code: project docs, rules and commands for developers and testers, from jsonxmleditor.com")
                .put("version", version + ".0");
        manifest.putObject("author").put("name", "jsonxmleditor.com").put("url", "https://jsonxmleditor.com");
        out.put(".claude-plugin/plugin.json", write(mapper, manifest));
        return out;
    }

    static String rewrite(String text, Set<String> skills, Set<String> agents) {
        String t = text;
        for (String n : skills) {
            String q = Pattern.quote(n);
            t = t.replaceAll("\\.claude/skills/" + q + "/", Matcher.quoteReplacement("${CLAUDE_PLUGIN_ROOT}/skills/" + n + "/"))
                    .replaceAll("(?<![\\w/.:-])/" + q + "(?![\\w-])", Matcher.quoteReplacement("/" + NAME + ":" + n));
        }
        for (String a : agents) {
            String q = Pattern.quote(a);
            t = t.replaceAll("(?m)^agent: " + q + "$", Matcher.quoteReplacement("agent: " + NAME + ":" + a))
                    .replaceAll("`" + q + "`", Matcher.quoteReplacement("`" + NAME + ":" + a + "`"));
        }
        return t;
    }

    private static void splitSettings(String text, Map<String, String> out, ObjectMapper mapper) {
        try {
            ObjectNode settings = (ObjectNode) mapper.readTree(text);
            JsonNode hooks = settings.remove("hooks");
            if (hooks != null && !hooks.isEmpty()) {
                ObjectNode file = mapper.createObjectNode();
                file.set("hooks", hooks);
                out.put("hooks/hooks.json", write(mapper, file));
            }
            out.put("templates/.claude/settings.json", write(mapper, settings));
        } catch (Exception ex) {
            throw new IllegalStateException("Could not split settings.json for the plugin", ex);
        }
    }

    private static String write(ObjectMapper mapper, JsonNode node) {
        try {
            return mapper.writerWithDefaultPrettyPrinter().writeValueAsString(node) + "\n";
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    /** Checks the plugin layout: the manifest, skill and agent files, and references between them. */
    public static List<SdlcIssue> validate(Map<String, String> files, Set<String> userEdited) {
        List<SdlcIssue> issues = new ArrayList<>();
        if (!files.containsKey(".claude-plugin/plugin.json")) issues.add(SdlcIssue.error(".claude-plugin/plugin.json", "missing"));
        for (Map.Entry<String, String> e : files.entrySet()) {
            String path = e.getKey();
            String text = e.getValue();
            List<SdlcIssue> found = new ArrayList<>();
            boolean skill = path.matches("skills/[^/]+/SKILL\\.md");
            boolean agent = path.matches("agents/[^/]+\\.md");
            if (skill || agent) {
                Map<?, ?> fm = frontmatter(text);
                if (fm == null) {
                    found.add(SdlcIssue.error(path, "invalid or missing YAML frontmatter"));
                } else if (skill && fm.get("name") != null && !path.equals("skills/" + fm.get("name") + "/SKILL.md")) {
                    found.add(SdlcIssue.error(path, "name doesn't match its folder"));
                } else if (agent && (fm.get("name") == null || fm.get("description") == null)) {
                    found.add(SdlcIssue.error(path, "agents need a name and a description"));
                }
            }
            if (path.startsWith("skills/") || path.startsWith("agents/")) {
                Matcher ref = PLUGIN_SKILL_REF.matcher(text);
                while (ref.find()) {
                    if (!files.containsKey("skills/" + ref.group(1) + "/SKILL.md")) {
                        found.add(SdlcIssue.error(path, "refers to skill " + ref.group(1) + ", which isn't in the plugin"));
                    }
                }
                Matcher field = AGENT_FIELD.matcher(text);
                while (field.find()) {
                    String value = field.group(1);
                    if (value.startsWith(NAME + ":") && !files.containsKey("agents/" + value.substring(NAME.length() + 1) + ".md")) {
                        found.add(SdlcIssue.error(path, "uses agent " + value + ", which isn't in the plugin"));
                    }
                }
            }
            if (path.endsWith(".json")) {
                try {
                    new ObjectMapper().readTree(text);
                } catch (Exception ex) {
                    found.add(SdlcIssue.error(path, "invalid JSON"));
                }
            }
            if (userEdited.contains(path)) found.replaceAll(i -> SdlcIssue.warning(i.path(), i.message() + " (in your edit)"));
            issues.addAll(found);
        }
        return issues;
    }

    private static Map<?, ?> frontmatter(String text) {
        if (!text.startsWith("---\n")) return null;
        int end = text.indexOf("\n---", 4);
        if (end < 0) return null;
        try {
            Object parsed = new Yaml(new SafeConstructor(new LoaderOptions())).load(text.substring(4, end));
            return parsed instanceof Map<?, ?> m ? m : null;
        } catch (Exception ex) {
            return null;
        }
    }
}
