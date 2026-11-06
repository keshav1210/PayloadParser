package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;
import org.yaml.snakeyaml.error.Mark;
import org.yaml.snakeyaml.error.MarkedYAMLException;
import org.yaml.snakeyaml.error.YAMLException;
import org.yaml.snakeyaml.nodes.Tag;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Shared YAML reading for the YAML_FORMAT and YAML_TO_JSON services.
 * Reads every document in the input ("---" separated) and turns parser errors
 * into "line N, column M: message" so the editor can point at the problem.
 * SnakeYAML is used directly (not Jackson's YAML reader) because only it resolves
 * anchors, aliases and "<<" merge keys.
 */
final class YamlSupport {

    private static final JsonNodeFactory NODES = JsonNodeFactory.instance;

    private YamlSupport() {
    }

    /** Keeps dates as written ("2026-01-05") instead of turning them into java.util.Date. */
    private static final class TextDatesConstructor extends SafeConstructor {
        TextDatesConstructor(LoaderOptions options) {
            super(options);
            yamlConstructors.put(Tag.TIMESTAMP, new ConstructYamlStr());
        }
    }

    private static Yaml newYaml() {
        LoaderOptions options = new LoaderOptions();
        options.setAllowDuplicateKeys(false);
        options.setCodePointLimit(10 * 1024 * 1024);
        return new Yaml(new TextDatesConstructor(options));
    }

    static List<JsonNode> readDocuments(String yaml) {
        if (yaml == null || yaml.isBlank()) {
            throw new IllegalArgumentException("line 1, column 1: The YAML is empty");
        }
        List<JsonNode> docs = new ArrayList<>();
        try {
            for (Object doc : newYaml().loadAll(yaml)) {
                if (doc != null) {
                    docs.add(toNode(doc));
                }
            }
        } catch (MarkedYAMLException e) {
            throw new IllegalArgumentException(describe(e), e);
        } catch (YAMLException e) {
            throw new IllegalArgumentException("line 1, column 1: " + e.getMessage(), e);
        }
        if (docs.isEmpty()) {
            throw new IllegalArgumentException("line 1, column 1: The YAML contains no data");
        }
        return docs;
    }

    private static JsonNode toNode(Object value) {
        if (value == null) return NODES.nullNode();
        if (value instanceof Map<?, ?> map) {
            ObjectNode obj = NODES.objectNode();
            map.forEach((k, v) -> obj.set(String.valueOf(k), toNode(v)));
            return obj;
        }
        if (value instanceof Collection<?> items) {
            ArrayNode arr = NODES.arrayNode();
            items.forEach(v -> arr.add(toNode(v)));
            return arr;
        }
        if (value instanceof String s) return NODES.textNode(s);
        if (value instanceof Boolean b) return NODES.booleanNode(b);
        if (value instanceof Integer i) return NODES.numberNode(i);
        if (value instanceof Long l) return NODES.numberNode(l);
        if (value instanceof BigInteger bi) return NODES.numberNode(bi);
        if (value instanceof Double d) {
            // JSON has no NaN or Infinity, so .nan and .inf stay as text
            return d.isNaN() || d.isInfinite() ? NODES.textNode(String.valueOf(d)) : NODES.numberNode(d);
        }
        if (value instanceof byte[] bytes) return NODES.textNode(Base64.getEncoder().encodeToString(bytes));
        return NODES.textNode(String.valueOf(value));
    }

    private static String describe(MarkedYAMLException m) {
        Mark mark = m.getProblemMark() != null ? m.getProblemMark() : m.getContextMark();
        String problem = m.getProblem() == null ? "Invalid YAML" : m.getProblem();
        if (m.getContext() != null && !problem.contains(m.getContext())) problem = m.getContext() + ": " + problem;
        problem = problem.replaceAll("\\s+", " ").trim();
        if (mark == null) return "line 1, column 1: " + problem;
        return "line " + (mark.getLine() + 1) + ", column " + (mark.getColumn() + 1) + ": " + problem;
    }
}
