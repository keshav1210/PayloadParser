package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.core.JsonLocation;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.MappingIterator;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import org.yaml.snakeyaml.error.Mark;
import org.yaml.snakeyaml.error.MarkedYAMLException;

import java.util.ArrayList;
import java.util.List;

/**
 * Shared YAML reading for the YAML_FORMAT and YAML_TO_JSON services.
 * Reads every document in the input ("---" separated) and turns parser errors
 * into "line N, column M: message" so the editor can point at the problem.
 */
final class YamlSupport {

    private static final YAMLMapper READER = YAMLMapper.builder(
                    YAMLFactory.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build())
            .build();

    private YamlSupport() {
    }

    static List<JsonNode> readDocuments(String yaml) {
        if (yaml == null || yaml.isBlank()) {
            throw new IllegalArgumentException("line 1, column 1: The YAML is empty");
        }
        List<JsonNode> docs = new ArrayList<>();
        try (MappingIterator<JsonNode> it = READER.readerFor(JsonNode.class).readValues(yaml)) {
            while (it.hasNextValue()) {
                JsonNode doc = it.nextValue();
                if (doc != null && !doc.isMissingNode()) {
                    docs.add(doc);
                }
            }
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException(describe(e), e);
        } catch (RuntimeException e) {
            // MappingIterator wraps parse errors in a RuntimeJsonMappingException
            Throwable cause = e.getCause();
            if (cause instanceof JsonProcessingException jpe) {
                throw new IllegalArgumentException(describe(jpe), e);
            }
            throw new IllegalArgumentException("line 1, column 1: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new IllegalArgumentException("line 1, column 1: " + e.getMessage(), e);
        }
        if (docs.isEmpty()) {
            throw new IllegalArgumentException("line 1, column 1: The YAML contains no data");
        }
        return docs;
    }

    private static String describe(JsonProcessingException e) {
        // SnakeYAML's "problem mark" is where the error actually is; Jackson sometimes
        // reports the surrounding context instead (e.g. the line before a bad tab)
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof MarkedYAMLException m && m.getProblemMark() != null) {
                Mark mark = m.getProblemMark();
                String problem = m.getProblem() == null ? "Invalid YAML" : m.getProblem();
                if (m.getContext() != null && !problem.contains(m.getContext())) problem = m.getContext() + ": " + problem;
                return "line " + (mark.getLine() + 1) + ", column " + (mark.getColumn() + 1) + ": "
                        + problem.replaceAll("\\s+", " ").trim();
            }
        }
        JsonLocation loc = e.getLocation();
        String msg = e.getOriginalMessage() == null ? "Invalid YAML" : e.getOriginalMessage();
        // SnakeYAML messages repeat the position and quote the source; keep the first sentence
        msg = msg.replaceAll("(?s)\\s+in 'reader'.*$", "")
                 .replaceAll("(?s)\\n\\s*\\n.*$", "")
                 .replaceAll("\\s+", " ")
                 .trim();
        if (loc != null && loc.getLineNr() > 0) {
            return "line " + loc.getLineNr() + ", column " + Math.max(1, loc.getColumnNr()) + ": " + msg;
        }
        return "line 1, column 1: " + msg;
    }
}
