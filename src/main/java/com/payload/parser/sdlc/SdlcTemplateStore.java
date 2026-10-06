package com.payload.parser.sdlc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;

/**
 * Loads the SDLC kit templates from {@code classpath:sdlc-templates/} once at startup.
 * The templates are server-side only: they're outside {@code static/}, so they are never served directly.
 */
@Component
public class SdlcTemplateStore {

    static final String ROOT = "sdlc-templates/";
    private static final String[] GROUP_DIRS = {"profiles", "testing-frameworks", "extras"};

    private final Map<String, SdlcPack> packs;
    private final JsonNode catalog;

    public SdlcTemplateStore(ObjectMapper mapper) throws IOException {
        PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        Map<String, Map<String, String>> filesByPack = new TreeMap<>();
        JsonNode catalogJson = null;

        for (Resource resource : resolver.getResources("classpath*:" + ROOT + "**")) {
            String url = URLDecoder.decode(resource.getURL().toString(), StandardCharsets.UTF_8);
            int at = url.lastIndexOf("/" + ROOT);
            if (at < 0 || url.endsWith("/") || !resource.isReadable()) continue;
            String rel = url.substring(at + ROOT.length() + 1);
            if (rel.equals("packs.json")) {
                try (InputStream in = resource.getInputStream()) {
                    catalogJson = mapper.readTree(in);
                }
                continue;
            }
            String[] key = packKey(rel);
            if (key == null) continue;
            String text;
            try (InputStream in = resource.getInputStream()) {
                text = new String(in.readAllBytes(), StandardCharsets.UTF_8).replace("\r\n", "\n");
            }
            Map<String, String> files = filesByPack.computeIfAbsent(key[0], k -> new TreeMap<>());
            String out = outputPath(key[1]);
            if (files.put(out, text) != null) {
                throw new IllegalStateException("Duplicate template " + out + " in pack " + key[0]);
            }
        }
        if (catalogJson == null || !filesByPack.containsKey("core")) {
            throw new IllegalStateException("SDLC templates not found on the classpath under " + ROOT);
        }
        this.catalog = catalogJson;

        Map<String, JsonNode> entries = new LinkedHashMap<>();
        for (JsonNode p : catalogJson.path("packs")) entries.put(p.path("id").asText(), p);

        Map<String, SdlcPack> loaded = new LinkedHashMap<>();
        for (Map.Entry<String, Map<String, String>> e : filesByPack.entrySet()) {
            String id = e.getKey();
            JsonNode meta = entries.get(id);
            String group = id.equals("core") ? "core" : meta == null ? "unknown" : meta.path("group").asText();
            String label = meta == null ? id : meta.path("label").asText(id);
            String requires = meta == null ? null : meta.path("requires").asText(null);
            loaded.put(id, new SdlcPack(id, group, label, requires, Collections.unmodifiableMap(e.getValue())));
        }
        this.packs = Collections.unmodifiableMap(loaded);
    }

    /** Returns {packId, pathInsidePack}, or null for files outside any pack (e.g. the README). */
    static String[] packKey(String rel) {
        int slash = rel.indexOf('/');
        if (slash < 0) return null;
        String first = rel.substring(0, slash);
        for (String group : GROUP_DIRS) {
            if (first.equals(group)) {
                String rest = rel.substring(slash + 1);
                int s2 = rest.indexOf('/');
                return s2 < 0 ? null : new String[]{rest.substring(0, s2), rest.substring(s2 + 1)};
            }
        }
        return new String[]{first, rel.substring(slash + 1)};
    }

    /** Template sources avoid names Claude Code would load in this repository. */
    static String outputPath(String path) {
        if (path.equals("CLAUDE.md.tmpl")) return "CLAUDE.md";
        if (path.equals("dot-gitignore")) return ".gitignore";
        if (path.startsWith("dot-claude/")) return ".claude/" + path.substring("dot-claude/".length());
        return path;
    }

    public Map<String, SdlcPack> packs() {
        return packs;
    }

    public SdlcPack pack(String id) {
        return packs.get(id);
    }

    /** The pack catalogue for the wizard: ids, labels, groups and detection hints. Never template content. */
    public JsonNode catalog() {
        return catalog;
    }

    public String kitVersion() {
        return catalog.path("version").asText("0.1");
    }
}
